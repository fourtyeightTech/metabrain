import { createHash, randomUUID } from 'node:crypto';
import { getState, setState, type Sql } from './db';
import { emptyAccount, stepPaper } from '../paper';
import { describeMarket } from '../stimulus';
import type { PaperAccount, PaperConfig, PredictionSummary, Tick } from '../types';

export interface BlockInput { number: number; hash: string; parentHash: string; ts: number; ticks: Tick[]; }
export async function recentTicks(db: Sql, limit = 300): Promise<Tick[]> {
  const rows = (await db.query<{ data: Tick }>('SELECT data FROM tray_events ORDER BY block_number DESC, (data->>\'logIndex\')::integer DESC LIMIT $1', [limit])).rows;
  return rows.map(r => r.data).reverse();
}
export async function applyBlock(db: Sql, block: BlockInput, cfg: PaperConfig, wallTime: number): Promise<boolean> {
  const existing = (await db.query<{ hash: string }>('SELECT hash FROM tray_blocks WHERE number=$1', [block.number])).rows[0];
  if (existing) {
    if (existing.hash !== block.hash) throw new Error('REORG_REQUIRED');
    return false;
  }
  const cursor = await getState<{ number: number; hash: string }>(db, 'cursor');
  if (cursor && (block.number !== cursor.number + 1 || block.parentHash !== cursor.hash)) throw new Error('NON_CANONICAL_PARENT');
  for (const tick of block.ticks) await db.query(
    'INSERT INTO tray_events(id,block_number,ts,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO NOTHING',
    [tick.id, block.number, tick.ts, JSON.stringify(tick)]);
  const history = await recentTicks(db);
  let paper = await getState<PaperAccount>(db, 'paper') ?? emptyAccount(cfg.initialQuote);
  const prediction = (await db.query<{ summary: PredictionSummary }>(
    'SELECT summary FROM tray_predictions WHERE available_at<=$1 ORDER BY available_at DESC LIMIT 1', [wallTime])).rows[0]?.summary ?? null;
  // Historical catch-up never invents retrospective trades or applies new predictions to old prices.
  if (block.ticks.length && wallTime - block.ts <= 30000 && wallTime >= block.ts) paper = stepPaper(paper, history, cfg, prediction, wallTime);
  await db.query('INSERT INTO tray_blocks(number,hash,parent_hash,ts,paper) VALUES($1,$2,$3,$4,$5::jsonb)',
    [block.number, block.hash, block.parentHash, block.ts, JSON.stringify(paper)]);
  await setState(db, 'paper', paper);
  await setState(db, 'cursor', { number: block.number, hash: block.hash, ts: block.ts });
  return true;
}
export async function rewind(db: Sql, ancestor: number, initialQuote: number) {
  const checkpoint = (await db.query<{ number: string; hash: string; ts: string; paper: PaperAccount }>(
    'SELECT number,hash,ts,paper FROM tray_blocks WHERE number=$1', [ancestor])).rows[0];
  if (!checkpoint) throw new Error('Reorg exceeds stored history; operator rebuild required');
  // Serialize with GPU publication BEFORE deleting results; otherwise a concurrent publisher could
  // insert between our DELETE and cancellation, leaving a prediction from an orphaned block.
  await db.query('SELECT id FROM tray_jobs WHERE source_block>$1 ORDER BY id FOR UPDATE', [ancestor]);
  await db.query('DELETE FROM tray_predictions WHERE id IN (SELECT id FROM tray_jobs WHERE source_block>$1)', [ancestor]);
  await db.query("UPDATE tray_jobs SET status='cancelled',lease_id=NULL,error='Source block orphaned' WHERE source_block>$1", [ancestor]);
  await db.query('DELETE FROM tray_events WHERE block_number>$1', [ancestor]);
  await db.query('DELETE FROM tray_blocks WHERE number>$1', [ancestor]);
  await setState(db, 'cursor', { number: Number(checkpoint.number), hash: checkpoint.hash, ts: Number(checkpoint.ts) });
  await setState(db, 'paper', checkpoint.paper ?? emptyAccount(initialQuote));
  await setState(db, 'lastJobAt', 0);
}
export async function queueInference(db: Sql, options: { now: number; contextSeconds: number; refreshSeconds: number; quote: string }) {
  const last = await getState<number>(db, 'lastJobAt') ?? 0;
  if (options.now - last < options.refreshSeconds * 1000) return;
  const cursor = await getState<{ number: number; ts: number; hash: string }>(db, 'cursor');
  if (!cursor || options.now - cursor.ts > 30000) return;
  const end = options.now; const start = end - options.contextSeconds * 1000;
  // Include a seed price before the window, then all events through the cutoff. Never future events.
  const rows = (await db.query<{ data: Tick }>(
    'SELECT data FROM tray_events WHERE ts<=$1 AND ts>=$2 ORDER BY block_number,(data->>\'logIndex\')::integer LIMIT 5001', [end, start])).rows;
  if (rows.length > 5000) throw new Error('Stimulus event limit exceeded; reduce context or aggregate explicitly');
  const seed = (await db.query<{ data: Tick }>('SELECT data FROM tray_events WHERE ts<$1 ORDER BY ts DESC LIMIT 1', [start])).rows[0]?.data;
  const ticks = [ ...(seed ? [seed] : []), ...rows.map(r => r.data) ];
  if (!ticks.length) return;
  const paper = await getState<PaperAccount>(db, 'paper');
  if (!paper) return;
  const input = { schemaVersion: 1, rendererVersion: 'tray-market-screen-v1', start, end,
    sourceBlock: cursor.number, sourceBlockHash: cursor.hash, quoteSymbol: options.quote,
    ticks, paper, text: describeMarket(ticks, paper, options.quote),
    portfolioTiming: 'cutoff snapshot, narrated in a constructed replay; media time is not live wall time',
    temporalMode: 'rolling-window-experimental' };
  const serialized = JSON.stringify(input);
  const hash = createHash('sha256').update(serialized).digest('hex');
  // Superseded work is cancelled before claiming, not allowed to create an unbounded live backlog.
  await db.query("UPDATE tray_jobs SET status='cancelled',error='Superseded by newer input' WHERE status='queued'");
  await db.query('INSERT INTO tray_jobs(id,input_hash,input,input_end,source_block) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(input_hash) DO NOTHING',
    [randomUUID(), hash, serialized, end, cursor.number]);
  await setState(db, 'lastJobAt', options.now);
}
