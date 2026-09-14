export type Mode = 'demo' | 'live';
export type Policy = 'observer' | 'momentum' | 'cortical';
export type Venue = 'pons-v2-curve' | 'uniswap-v3' | 'uniswap-v4';
export interface Tick {
  id: string; ts: number; price: number; quoteAmount: number; tokenAmount: number;
  side: 'buy' | 'sell'; venue: Venue; blockNumber: number; blockHash: string;
  txHash: string; logIndex: number; raw: Record<string, string>;
}
export interface PaperConfig {
  initialQuote: number; feeBps: number; slippageBps: number; maxExposure: number;
  policy: Policy; minIntervalMs: number; maxPredictionAgeMs: number;
}
export interface Fill {
  id: string; ts: number; side: 'buy' | 'sell'; quantity: number; price: number;
  notional: number; fee: number; realizedPnl: number; reason: string;
  tickId: string; predictionId: string | null;
}
export interface PaperAccount {
  cash: number; units: number; costBasis: number; realizedPnl: number;
  totalFees: number; lastDecisionAt: number; peakEquity: number; maxDrawdown: number;
  fills: Fill[];
}
export interface PredictionSummary {
  id: string; source: 'tribe-v2'; inputStart: number; inputEnd: number;
  availableAt: number; modelRevision: string; stimulusHash: string;
  outputHash: string; meanAbsoluteResponse: number; responseChange: number | null;
  sampleCount: number; vertexCount: number; latencyMs: number;
  alignment: 'upstream-segment-timestamps'; runMode: 'rolling-window-experimental';
}
export interface PredictionResult extends PredictionSummary {
  values: number[]; times: number[]; responseTrace: number[];
  segmentOffsets: number[]; colorLimit: number;
  manifest: Record<string, unknown>;
}
export interface Snapshot {
  mode: Mode; symbol: string; quoteSymbol: string; now: number;
  connected: boolean; stale: boolean; message: string; chainId: number | null;
  token: string | null; confirmationBlocks: number; indexedBlock: number | null;
  heartbeat: number | null; ticks: Tick[]; paper: PaperAccount; paperConfig: PaperConfig;
  prediction: PredictionSummary | null; inferenceEnabled: boolean;
  inferenceStatus: string; jobs: { queued: number; running: number; failed: number };
  stimulus: { text: string; inputEnd: number | null };
}
export interface MeshData { vertices: number[]; faces: number[]; hemisphereBoundary: number; mesh: 'fsaverage5'; }

export const DEFAULT_PAPER_CONFIG: PaperConfig = {
  initialQuote: 10000, feeBps: 30, slippageBps: 20, maxExposure: 0.25,
  policy: 'observer', minIntervalMs: 30000, maxPredictionAgeMs: 45000
};
