import { DEFAULT_PAPER_CONFIG, type FeedStatus, type Snapshot } from '../types';
import { emptyAccount } from '../paper';
import { feedSource, observerConfiguration } from './config';
import { liveSnapshot } from './snapshot';
import { rpcSnapshot } from './rpc-observer';

function unavailable(source: FeedStatus['source'], message: string, missing: string[] = [], invalid: string[] = []): Snapshot {
  return { mode: 'live', symbol: 'TOKEN', quoteSymbol: 'QUOTE', now: Date.now(), connected: false, stale: true, message,
    chainId: null, token: null, confirmationBlocks: 0, indexedBlock: null, heartbeat: null, ticks: [],
    paper: emptyAccount(DEFAULT_PAPER_CONFIG.initialQuote), paperConfig: { ...DEFAULT_PAPER_CONFIG },
    prediction: null, inferenceEnabled: false, inferenceStatus: 'No Meta model output has been received.',
    jobs: { queued: 0, running: 0, failed: 0 }, stimulus: { text: 'Connect a real market to begin receiving events.', inputEnd: null }, epochs: [],
    feed: { source, phase: missing.length || invalid.length ? 'setup' : 'error', checkedAt: null, chainHead: null,
      fromBlock: null, toBlock: null, blockTimestamp: null, pollMs: 5000, missing, invalid, explorer: null, truncated: false }
  };
}
export async function getLiveFeed(): Promise<Snapshot> {
  const source = feedSource();
  if (source === 'rpc') {
    const { config, missing, invalid } = observerConfiguration();
    if (!config) return unavailable(source, 'Connect your token to start the live feed. Add the listed server environment variables and redeploy.', missing, invalid);
    try { return await rpcSnapshot(config); }
    catch { return { ...unavailable(source, 'RPC observation failed. Check the endpoint, chain ID, token and factory/pool contract version.'), chainId: config.CHAIN_ID, token: config.TOKEN_ADDRESS }; }
  }
  if (!process.env.DATABASE_READ_URL && !process.env.DATABASE_URL) return unavailable(source, 'The indexed feed needs a database connection.', ['DATABASE_READ_URL']);
  try {
    const snapshot = await liveSnapshot();
    return { ...snapshot, feed: { source, phase: snapshot.stale ? 'stale' : snapshot.ticks.length ? 'live' : 'waiting',
      checkedAt: snapshot.now, chainHead: null, fromBlock: null, toBlock: snapshot.indexedBlock, blockTimestamp: null,
      pollMs: 2000, missing: [], invalid: [], explorer: publicExplorer(), truncated: false } };
  } catch { return unavailable(source, 'Database unavailable or migration missing. Check the read connection and persistent indexer.'); }
}
function publicExplorer() {
  try { const u = new URL(process.env.BLOCK_EXPLORER_URL || ''); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash ? u.href.replace(/\/$/, '') : null; }
  catch { return null; }
}
