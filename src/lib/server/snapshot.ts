import { pool, getState } from './db';
import { recentTicks } from './store';
import { paperConfig } from './config';
import { emptyAccount } from '../paper';
import { describeMarket } from '../stimulus';
import type { CorticalEpoch, PaperAccount, PaperConfig, PredictionSummary, Snapshot, Tick } from '../types';

export function buildCorticalEpoch(summary: PredictionSummary, input: { ticks?: Tick[] }): CorticalEpoch {
  const ticks = input.ticks ?? []; const first = ticks[0]; const last = ticks.at(-1);
  const priceChangePct = first && last ? (last.price / first.price - 1) * 100 : null;
  const observedVolume = ticks.reduce((sum, tick) => sum + tick.quoteAmount, 0);
  const regime = priceChangePct !== null && priceChangePct >= 3 ? 'rally'
    : priceChangePct !== null && priceChangePct <= -3 ? 'selloff'
    : ticks.length >= 12 ? 'active' : 'quiet';
  return { ...summary, tradeCount: ticks.length, observedVolume, priceChangePct, regime };
}

export async function liveSnapshot(): Promise<Snapshot> {
  const db = pool(true); const now = Date.now();
  const [ticks, paper, cursor, health, predictionRows, epochRows, jobs, storedConfig, market] = await Promise.all([
    recentTicks(db), getState<PaperAccount>(db, 'paper'),
    getState<{ number: number; ts: number }>(db, 'cursor'),
    getState<{ heartbeat: number; message: string; ok: boolean }>(db, 'health'),
    db.query<{ summary: PredictionSummary }>('SELECT summary FROM metatray_predictions ORDER BY available_at DESC LIMIT 1'),
    db.query<{ summary: PredictionSummary; input: { ticks?: Tick[] } }>('SELECT p.summary,j.input FROM metatray_predictions p JOIN metatray_jobs j ON j.id=p.id ORDER BY p.available_at DESC LIMIT 24'),
    db.query<{ status: string; count: string }>("SELECT status,count(*) FROM metatray_jobs WHERE status IN ('queued','running','failed') GROUP BY status"),
    getState<PaperConfig>(db, 'paperConfig'),
    getState<{ chainId: number; token: string; symbol: string; quoteSymbol: string; confirmationBlocks: number; inferenceEnabled: boolean }>(db, 'market')
  ]);
  const cfg = storedConfig ?? paperConfig(); const account = paper ?? emptyAccount(cfg.initialQuote);
  const status = { queued: 0, running: 0, failed: 0 };
  for (const row of jobs.rows) status[row.status as keyof typeof status] = Number(row.count);
  const prediction = predictionRows.rows[0]?.summary ?? null;
  const stale = !health || now - health.heartbeat > 15000 || !health.ok;
  return { mode: 'live', symbol: market?.symbol ?? 'METATRAY', quoteSymbol: market?.quoteSymbol ?? 'QUOTE',
    now, connected: !!health && !stale, stale, message: health?.message ?? 'Waiting for the indexer service',
    chainId: market?.chainId ?? null, token: market?.token ?? null,
    confirmationBlocks: market?.confirmationBlocks ?? 0, indexedBlock: cursor?.number ?? null,
    heartbeat: health?.heartbeat ?? null, ticks, paper: account, paperConfig: cfg, prediction,
    inferenceEnabled: market?.inferenceEnabled ?? false,
    inferenceStatus: prediction ? 'TRIBE result available' : status.running ? 'Inference in progress' : status.queued ? 'Waiting for GPU worker' : 'No cortical prediction available',
    jobs: status, stimulus: { text: describeMarket(ticks, account, market?.quoteSymbol), inputEnd: ticks.at(-1)?.ts ?? null },
    epochs: epochRows.rows.map(row => buildCorticalEpoch(row.summary, row.input)) };
}
