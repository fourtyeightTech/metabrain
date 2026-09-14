import { createPublicClient, http, zeroAddress, type PublicClient } from 'viem';
import { createHash } from 'node:crypto';
import { DEFAULT_PAPER_CONFIG, type Snapshot } from '../types';
import { emptyAccount } from '../paper';
import { describeMarket } from '../stimulus';
import { decodeSwap, discoverMarket, ERC20, fetchLogs } from './chain';
import type { ObserverConfig } from './config';

// Read-only recent-window observation. No durable ledger, model jobs, signing or orders.
export async function readRecentMarket(client: PublicClient, cfg: ObserverConfig): Promise<Snapshot> {
  const market = await discoverMarket(client, cfg);
  const head = await client.getBlockNumber({ cacheTime: 0 });
  if (head < BigInt(cfg.CONFIRMATION_BLOCKS) || head > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Unsupported chain height');
  const to = head - BigInt(cfg.CONFIRMATION_BLOCKS);
  const from = to >= BigInt(cfg.RPC_RECENT_BLOCKS - 1) ? to - BigInt(cfg.RPC_RECENT_BLOCKS - 1) : 0n;
  const anchor = await client.getBlock({ blockNumber: to });
  if (!anchor.hash) throw new Error('Missing confirmed block');
  const logs = await fetchLogs(client, market, from, to);
  const usable = logs.filter(log => !log.removed && log.blockNumber !== null && log.blockNumber >= from && log.blockNumber <= to);
  const selected = usable.slice(-cfg.RPC_MAX_EVENTS);
  const numbers = [...new Set(selected.map(log => log.blockNumber!))];
  const blocks = new Map([[to, anchor]]);
  // Small concurrent batches bound provider load when a window spans many blocks.
  for (let i = 0; i < numbers.length; i += 12) {
    const fetched = await Promise.all(numbers.slice(i, i + 12).filter(n => n !== to).map(n => client.getBlock({ blockNumber: n })));
    for (const block of fetched) if (block.number !== null) blocks.set(block.number, block);
  }
  const ticks = selected.map(log => {
    const block = blocks.get(log.blockNumber!);
    if (!block || !block.hash || block.hash !== log.blockHash) throw new Error('Chain changed while observing');
    // Curves use the actual event execution ratio; no historical reserve oracle is assumed.
    return decodeSwap(log, market, cfg.CHAIN_ID, Number(block.timestamp) * 1000);
  }).filter(t => t !== null);
  const unique = [...new Map(ticks.map(t => [t.id, t])).values()];
  // Detect a reorg during the read; the next poll re-reads the entire authoritative window.
  if ((await client.getBlock({ blockNumber: to })).hash !== anchor.hash) throw new Error('Chain changed while observing');
  const symbols = await Promise.allSettled([
    client.readContract({ address: market.token, abi: ERC20, functionName: 'symbol' }),
    market.quote === zeroAddress ? Promise.resolve('ETH') : client.readContract({ address: market.quote, abi: ERC20, functionName: 'symbol' })
  ]);
  const displaySymbol = (value: PromiseSettledResult<string>, fallback: string) => value.status === 'fulfilled'
    ? value.value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24) || fallback : fallback;
  const now = Date.now(); const blockTimestamp = Number(anchor.timestamp) * 1000;
  const stale = now - blockTimestamp > 180000 || blockTimestamp > now + 30000;
  const paper = emptyAccount(DEFAULT_PAPER_CONFIG.initialQuote);
  const quoteSymbol = displaySymbol(symbols[1], cfg.METATRAY_QUOTE_SYMBOL);
  return { mode: 'live', symbol: displaySymbol(symbols[0], cfg.METATRAY_TOKEN_SYMBOL), quoteSymbol,
    now, connected: !stale, stale, chainId: cfg.CHAIN_ID, token: cfg.TOKEN_ADDRESS, confirmationBlocks: cfg.CONFIRMATION_BLOCKS,
    indexedBlock: Number(to), heartbeat: now, ticks: unique, paper, paperConfig: { ...DEFAULT_PAPER_CONFIG },
    message: stale ? 'RPC responded, but the latest confirmed block is old. Check the network and provider.'
      : unique.length ? 'Real decoded swaps from the configured token. Recent window re-read on each poll.'
      : 'RPC connected. No matching swaps in the recent block window; waiting for actual trades.',
    prediction: null, inferenceEnabled: false, inferenceStatus: 'RPC observer connected to market data only. Meta inference needs the indexed GPU pipeline.',
    jobs: { queued: 0, running: 0, failed: 0 }, stimulus: { text: describeMarket(unique, paper, quoteSymbol), inputEnd: unique.at(-1)?.ts ?? null }, epochs: [],
    feed: { source: 'rpc', phase: stale ? 'stale' : unique.length ? 'live' : 'waiting', checkedAt: now, chainHead: Number(head),
      fromBlock: Number(from), toBlock: Number(to), blockTimestamp, pollMs: 5000, missing: [], invalid: [],
      explorer: cfg.BLOCK_EXPLORER_URL?.replace(/\/$/, '') ?? null, truncated: usable.length > cfg.RPC_MAX_EVENTS }
  };
}

let cached: { key: string; expires: number; value: Snapshot } | undefined;
let pending: { key: string; task: Promise<Snapshot> } | undefined;
export function rpcSnapshot(cfg: ObserverConfig): Promise<Snapshot> {
  const key = createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
  if (cached?.key === key && cached.expires > Date.now()) return Promise.resolve(cached.value);
  if (pending?.key === key) return pending.task;
  const client = createPublicClient({ transport: http(cfg.RPC_HTTP_URL, { timeout: 4000, retryCount: 0,
    batch: { batchSize: 20, wait: 10 }, fetchOptions: { signal: AbortSignal.timeout(10000) } }) }) as PublicClient;
  const task = readRecentMarket(client, cfg).then(value => { cached = { key, value, expires: Date.now() + 4000 }; return value; })
    .finally(() => { if (pending?.task === task) pending = undefined; });
  pending = { key, task }; return task;
}
