import type { Tick, PredictionSummary } from '../src/lib/types';
export const at = 1700000000000;
export function tick(price: number, seconds: number, block = seconds): Tick {
  return { id: `fixture-${block}`, ts: at + seconds * 1000, price, quoteAmount: 50, tokenAmount: 50 / price,
    side: 'buy', venue: 'pons-v2-curve', blockNumber: block, blockHash: `block-${block}`,
    txHash: '', logIndex: 0, raw: {} };
}
export function prediction(now: number): PredictionSummary {
  return { id: '00000000-0000-4000-8000-000000000001', source: 'tribe-v2', inputStart: now - 110000,
    inputEnd: now - 10000, availableAt: now - 5000, modelRevision: 'fixture-not-a-model', stimulusHash: 'fixture',
    outputHash: 'fixture', meanAbsoluteResponse: 0.2, responseChange: .05, sampleCount: 100, vertexCount: 20484,
    latencyMs: 5000, alignment: 'upstream-segment-timestamps', runMode: 'rolling-window-experimental' };
}
