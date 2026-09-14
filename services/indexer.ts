import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createPublicClient, webSocket, formatUnits, type PublicClient } from 'viem';
import { liveConfig, paperConfig } from '../src/lib/server/config';
import { pool, getState, setState, transaction } from '../src/lib/server/db';
import { CURVE, decodeSwap, discoverMarket, fetchLogs, makeClient } from '../src/lib/server/chain';
import { applyBlock, queueInference, rewind } from '../src/lib/server/store';

const cfg = liveConfig(); const paper = paperConfig(); const db = pool();
const client = makeClient(cfg) as PublicClient;
const market = await discoverMarket(client, cfg);
const lock = await db.connect();
const locked = await lock.query('SELECT pg_try_advisory_lock(72389411) AS locked');
if (!locked.rows[0].locked) throw new Error('A Tray indexer already owns this database');
const identity = { chainId: cfg.CHAIN_ID, token: cfg.TOKEN_ADDRESS, startBlock: cfg.TOKEN_START_BLOCK, confirmations: cfg.CONFIRMATION_BLOCKS, market, paper };
const signature = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
const previous = await getState<string>(db, 'configurationHash');
if (previous && previous !== signature) throw new Error('Database belongs to a different market/paper configuration. Use a fresh database or follow the documented reset procedure.');
await setState(db, 'configurationHash', signature);
await setState(db, 'paperConfig', paper);
await setState(db, 'market', { chainId: cfg.CHAIN_ID, token: cfg.TOKEN_ADDRESS,
  symbol: cfg.TRAY_TOKEN_SYMBOL, quoteSymbol: cfg.TRAY_QUOTE_SYMBOL,
  confirmationBlocks: cfg.CONFIRMATION_BLOCKS, inferenceEnabled: cfg.INFERENCE_ENABLED === 'true' });
let busy = false; let stopping = false;
async function sync() {
  if (busy || stopping) return;
  busy = true;
  try {
    let cursor = await getState<{ number: number; hash: string }>(db, 'cursor');
    if (cursor) {
      const head = await client.getBlock({ blockNumber: BigInt(cursor.number) });
      if (head.hash !== cursor.hash) {
        const checkpoints = (await db.query<{ number: string; hash: string }>('SELECT number,hash FROM tray_blocks ORDER BY number DESC LIMIT $1', [cfg.REORG_HISTORY_BLOCKS])).rows;
        let ancestor: number | null = null;
        for (const b of checkpoints) if ((await client.getBlock({ blockNumber: BigInt(b.number) })).hash === b.hash) { ancestor = Number(b.number); break; }
        if (ancestor === null) throw new Error('Deep reorg: no stored canonical ancestor; operator rebuild required');
        await transaction(tx => rewind(tx, ancestor!, paper.initialQuote));
        cursor = await getState(db, 'cursor');
      }
    }
    const tip = Number(await client.getBlockNumber({ cacheTime: 0 })) - cfg.CONFIRMATION_BLOCKS;
    const from = cursor ? cursor.number + 1 : cfg.TOKEN_START_BLOCK;
    const to = Math.min(tip, from + cfg.RPC_BLOCK_BATCH - 1);
    if (from <= to) {
      const logs = await fetchLogs(client, market, BigInt(from), BigInt(to));
      for (let n = from; n <= to; n++) {
        const block = await client.getBlock({ blockNumber: BigInt(n) });
        if (!block.hash) throw new Error('Block not available');
        const blockLogs = logs.filter(l => Number(l.blockNumber) === n);
        if (blockLogs.some(l => l.blockHash !== block.hash)) throw new Error('Block changed while logs were fetched; retrying');
        let curvePrice: number | undefined;
        if (market.curve && blockLogs.some(l => l.address.toLowerCase() === market.curve!.toLowerCase())) {
          const [quoteReserve, tokenReserve] = await client.readContract({ address: market.curve, abi: CURVE,
            functionName: 'getReserves', blockNumber: BigInt(n) });
          if (tokenReserve > 0n && quoteReserve > 0n) curvePrice = Number(formatUnits(quoteReserve, market.quoteDecimals)) / Number(formatUnits(tokenReserve, market.tokenDecimals));
          // Graduation can empty reserves; decodeSwap labels the event's effective execution ratio in that case.
        }
        const ts = Number(block.timestamp) * 1000;
        const ticks = blockLogs.map(log => decodeSwap(log, market, cfg.CHAIN_ID, ts, curvePrice)).filter(t => t !== null);
        await transaction(tx => applyBlock(tx, { number: n, hash: block.hash!, parentHash: block.parentHash, ts, ticks }, paper, Date.now()));
      }
    }
    if (cfg.INFERENCE_ENABLED === 'true') await transaction(tx => queueInference(tx, {
      now: Date.now(), contextSeconds: cfg.INFERENCE_CONTEXT_SECONDS, refreshSeconds: cfg.INFERENCE_REFRESH_SECONDS, quote: cfg.TRAY_QUOTE_SYMBOL }));
    const current = await getState<{ number: number }>(db, 'cursor');
    if (current) await db.query(`DELETE FROM tray_blocks b WHERE b.number<$1 AND NOT EXISTS (
      SELECT 1 FROM tray_jobs j WHERE j.source_block=b.number AND j.status IN ('queued','running'))`,
      [current.number - cfg.REORG_HISTORY_BLOCKS + 1]);
    await setState(db, 'health', { heartbeat: Date.now(), ok: true,
      message: from <= to && to < tip ? `Catching up: indexed block ${to} of ${tip}` : 'Following mined events; confirmation depth is not a finality guarantee.' });
  } catch (error) {
    const message = error instanceof Error && /reorg|canonical|Graduation|changed while/.test(error.message) ? error.message : 'Indexer error. Check private worker logs and RPC configuration.';
    console.error('Indexer sync failed:', error instanceof Error ? error.name : 'UnknownError');
    await setState(db, 'health', { heartbeat: Date.now(), ok: false, message }).catch(() => {});
  } finally { busy = false; }
}
await sync();
const timer = setInterval(() => { void sync(); }, 2000);
let unwatch: (() => void) | undefined;
if (cfg.RPC_WS_URL) {
  const ws = createPublicClient({ transport: webSocket(cfg.RPC_WS_URL, { reconnect: true }) });
  unwatch = ws.watchBlockNumber({ onBlockNumber: () => { void sync(); }, onError: () => console.error('WebSocket interrupted; HTTP catch-up remains active.') });
}
console.log('Tray indexer running. Paper-only; no signing keys.');
async function shutdown() {
  stopping = true; clearInterval(timer); unwatch?.();
  while (busy) await new Promise(resolve => setTimeout(resolve, 50));
  await lock.query('SELECT pg_advisory_unlock(72389411)'); lock.release(); await db.end();
}
process.on('SIGTERM', () => { void shutdown(); }); process.on('SIGINT', () => { void shutdown(); });
