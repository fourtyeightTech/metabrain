import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex, type Log, type PublicClient } from 'viem';
import { V3, discoverMarket } from '../src/lib/server/chain';
import { readRecentMarket } from '../src/lib/server/rpc-observer';
import { observerConfiguration, type ObserverConfig } from '../src/lib/server/config';
import { getLiveFeed } from '../src/lib/server/live-feed';
import { transactionUrl } from '../src/lib/sources';
import { buildCorticalEpoch } from '../src/lib/server/snapshot';
import { prediction } from './fixtures';

// Controlled contract/event fixtures. These are not receipts from a real token.
const token = '0x1111111111111111111111111111111111111111' as Address;
const quote = '0x2222222222222222222222222222222222222222' as Address;
const pool = '0x3333333333333333333333333333333333333333' as Address;
const hash = `0x${'11'.repeat(32)}` as Hex;
const cfg: ObserverConfig = { RPC_HTTP_URL: 'https://rpc.invalid', CHAIN_ID: 1, TOKEN_ADDRESS: token,
  MARKET_PROTOCOL: 'uniswap-v3', V3_POOL_ADDRESS: pool, CONFIRMATION_BLOCKS: 2, RPC_RECENT_BLOCKS: 5,
  RPC_MAX_EVENTS: 100, METATRAY_TOKEN_SYMBOL: 'FALLBACK', METATRAY_QUOTE_SYMBOL: 'QUOTE' };
function event(overrides: Partial<Log> = {}): Log {
  return { address: pool, topics: encodeEventTopics({ abi: V3, eventName: 'Swap', args: { sender: token, recipient: quote } }) as [Hex, ...Hex[]],
    data: encodeAbiParameters([{ type: 'int256' }, { type: 'int256' }, { type: 'uint160' }, { type: 'uint128' }, { type: 'int24' }],
      [-(10n ** 18n), 2n * 10n ** 18n, 2n ** 96n, 1n, 0]),
    blockNumber: 98n, blockHash: hash, transactionHash: hash, transactionIndex: 0, logIndex: 0, removed: false, ...overrides };
}
function fixture(logs: Log[] = [event()], overrides: Record<string, unknown> = {}) {
  const requests: { fromBlock: bigint; toBlock: bigint }[] = [];
  const client = {
    getChainId: async () => 1,
    getCode: async () => '0x01',
    readContract: async ({ functionName, address }: { functionName: string; address: Address }) => {
      if (functionName === 'decimals') return 18;
      if (functionName === 'symbol') return address === token ? 'ACTUAL' : 'ASSET';
      if (functionName === 'token0') return token;
      if (functionName === 'token1') return quote;
      throw new Error('Unexpected contract call');
    },
    getBlockNumber: async () => 100n,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ number: blockNumber, hash, timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    getLogs: async (request: { fromBlock: bigint; toBlock: bigint }) => { requests.push(request); return logs; },
    ...overrides
  } as unknown as PublicClient;
  return { client, requests };
}
test('RPC observer uses confirmed bounds, raw receipts and actual asset metadata without model or trading claims', async () => {
  const { client, requests } = fixture([event(), event(), event({ removed: true, logIndex: 1 }), event({ blockNumber: 99n, logIndex: 2 })]);
  const s = await readRecentMarket(client, cfg);
  assert.equal(requests[0].fromBlock, 94n); assert.equal(requests[0].toBlock, 98n);
  assert.equal(s.mode, 'live'); assert.equal(s.feed?.phase, 'live'); assert.equal(s.ticks.length, 1);
  assert.equal(s.ticks[0].txHash, hash); assert.equal(s.ticks[0].raw.tokenAmount, '1000000000000000000');
  assert.equal(s.symbol, 'ACTUAL'); assert.equal(s.quoteSymbol, 'ASSET');
  assert.equal(s.prediction, null); assert.equal(s.inferenceEnabled, false); assert.deepEqual(s.paper.fills, []);
});
test('quiet connected market is empty; event cap is disclosed and uses newest logs', async () => {
  const quiet = await readRecentMarket(fixture([]).client, cfg);
  assert.equal(quiet.connected, true); assert.equal(quiet.feed?.phase, 'waiting'); assert.deepEqual(quiet.ticks, []);
  const busy = await readRecentMarket(fixture([event(), event({ logIndex: 1 })]).client, { ...cfg, RPC_MAX_EVENTS: 1 });
  assert.equal(busy.ticks[0].logIndex, 1); assert.equal(busy.feed?.truncated, true);
});
test('wrong chain, mismatched event block and reorg during polling are rejected', async () => {
  await assert.rejects(readRecentMarket(fixture([], { getChainId: async () => 2 }).client, cfg), /chain ID/);
  await assert.rejects(readRecentMarket(fixture([event({ blockHash: `0x${'22'.repeat(32)}` })]).client, cfg), /Chain changed/);
  let calls = 0;
  await assert.rejects(readRecentMarket(fixture([], { getBlock: async () => ({ number: 98n,
    hash: ++calls === 1 ? hash : `0x${'22'.repeat(32)}`, timestamp: BigInt(Math.floor(Date.now() / 1000)) }) }).client, cfg), /Chain changed/);
});
test('a responding provider with an old confirmed block is stale', async () => {
  const s = await readRecentMarket(fixture([], { getBlock: async () => ({ number: 98n, hash, timestamp: 1n }) }).client, cfg);
  assert.equal(s.connected, false); assert.equal(s.stale, true); assert.equal(s.feed?.phase, 'stale');
});
test('Pons V2 discovers its hook/manager and rejects a configured mismatch', async () => {
  const hook = '0x4444444444444444444444444444444444444444' as Address;
  const manager = '0x5555555555555555555555555555555555555555' as Address;
  const client = fixture([], { readContract: async ({ functionName }: { functionName: string }) => {
    if (functionName === 'decimals') return 18;
    if (functionName === 'memeHook') return hook;
    if (functionName === 'poolManager') return manager;
    if (functionName === 'getLaunchedToken') return { exists: true, token, pairToken: quote, curve: pool, poolFee: 3000, tickSpacing: 60 };
    throw new Error('Unexpected contract call');
  } }).client;
  const pons = { ...cfg, MARKET_PROTOCOL: 'pons-v2' as const, PONS_FACTORY_ADDRESS: pool };
  const m = await discoverMarket(client, pons);
  assert.equal(m.manager, manager); assert.equal(m.curve, pool); assert.match(m.poolId!, /^0x[0-9a-f]{64}$/);
  await assert.rejects(discoverMarket(client, { ...pons, PONS_HOOK_ADDRESS: quote }), /configuration mismatch/);
});
test('missing or invalid live config exposes names only and never falls back to demo', async () => {
  const keys = ['METATRAY_FEED', 'DATABASE_URL', 'DATABASE_READ_URL', 'RPC_HTTP_URL', 'CHAIN_ID', 'TOKEN_ADDRESS', 'MARKET_PROTOCOL', 'V3_POOL_ADDRESS', 'PONS_FACTORY_ADDRESS', 'PONS_HOOK_ADDRESS', 'V4_POOL_MANAGER_ADDRESS', 'BLOCK_EXPLORER_URL'];
  const prior = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    process.env.METATRAY_FEED = 'rpc';
    const missing = await getLiveFeed();
    assert.equal(missing.mode, 'live'); assert.equal(missing.feed?.phase, 'setup'); assert.deepEqual(missing.ticks, []);
    assert.deepEqual(missing.feed?.missing, ['RPC_HTTP_URL', 'CHAIN_ID', 'TOKEN_ADDRESS', 'PONS_FACTORY_ADDRESS']);
    process.env.RPC_HTTP_URL = 'invalid-private-provider-value';
    const invalid = observerConfiguration(); assert.ok(invalid.invalid.includes('RPC_HTTP_URL'));
    assert.ok(!JSON.stringify(await getLiveFeed()).includes('invalid-private-provider-value'));
  } finally { for (const k of keys) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; } }
});
test('transaction links only use valid public HTTPS explorer bases and receipt hashes', () => {
  const credentialed = new URL('https://explorer.invalid'); credentialed.username = 'private'; credentialed.password = 'secret';
  const queried = new URL('https://explorer.invalid'); queried.searchParams.set('key', 'secret');
  assert.equal(transactionUrl('https://explorer.invalid/', hash), `https://explorer.invalid/tx/${hash}`);
  assert.equal(transactionUrl(credentialed.href, hash), null);
  assert.equal(transactionUrl(queried.href, hash), null);
  assert.equal(transactionUrl('javascript:alert(1)', hash), null);
  assert.equal(transactionUrl('https://explorer.invalid', 'synthetic'), null);
});
test('cortical epochs pair a completed result with its exact market window', () => {
  const first = { id: 'first', ts: 1, price: 1, quoteAmount: 4, tokenAmount: 4, side: 'buy' as const,
    venue: 'uniswap-v3' as const, blockNumber: 1, blockHash: hash, txHash: hash, logIndex: 0, raw: {} };
  const last = { ...first, id: 'last', ts: 2, price: 1.05, quoteAmount: 6, logIndex: 1 };
  const result = buildCorticalEpoch(prediction(Date.now()), { ticks: [first, last] });
  assert.equal(result.regime, 'rally'); assert.equal(result.tradeCount, 2); assert.equal(result.observedVolume, 10);
  assert.ok(result.priceChangePct !== null && Math.abs(result.priceChangePct - 5) < 1e-9);
});
