import { emptyAccount, stepPaper } from './paper';
import { describeMarket } from './stimulus';
import { DEFAULT_PAPER_CONFIG, type Policy, type Snapshot, type Tick } from './types';

// Explicitly synthetic and reproducible. No neural model or on-chain claims.
export function demoPrice(i: number): number {
  return 0.0042 * Math.exp(0.00028 * i + 0.04 * Math.sin(i / 19) + 0.011 * Math.sin(i / 3.9));
}
export function demoSnapshot(step = 180, policy: Policy = 'momentum'): Snapshot {
  const now = Date.now(); const ticks: Tick[] = [];
  const cfg = { ...DEFAULT_PAPER_CONFIG, policy };
  let paper = emptyAccount(cfg.initialQuote);
  for (let i = 0; i <= step; i++) {
    const price = demoPrice(i); const amount = 18 + ((i * 71) % 240);
    const tick: Tick = { id: `demo:${i}`, ts: now - (step - i) * 2000, price,
      quoteAmount: amount, tokenAmount: amount / price, side: price >= demoPrice(i - 1) ? 'buy' : 'sell',
      venue: 'pons-v2-curve', blockNumber: 100000 + i, blockHash: '', txHash: '', logIndex: 0,
      raw: { source: 'synthetic-demo' } };
    ticks.push(tick); paper = stepPaper(paper, ticks, cfg, null, tick.ts);
  }
  return { mode: 'demo', symbol: 'TRAY', quoteSymbol: 'DEMO', now, connected: true,
    stale: false, message: 'Synthetic market replay. No on-chain events or cortical predictions.',
    chainId: null, token: null, indexedBlock: null, confirmationBlocks: 0,
    heartbeat: now, ticks: ticks.slice(-300), paper, paperConfig: cfg, prediction: null,
    inferenceEnabled: false, inferenceStatus: 'Awaiting authorized TRIBE service',
    jobs: { queued: 0, running: 0, failed: 0 }, stimulus: { text: describeMarket(ticks, paper, 'demo quote units'), inputEnd: now } };
}
