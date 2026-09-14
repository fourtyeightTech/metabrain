import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex, type Log } from 'viem';
import { CURVE, V3, V4, decodeSwap, spotFromSqrt, type MarketConfig } from '../src/lib/server/chain';
const token = '0x1111111111111111111111111111111111111111' as Address;
const quote = '0x2222222222222222222222222222222222222222' as Address;
const venue = '0x3333333333333333333333333333333333333333' as Address;
const id = `0x${'11'.repeat(32)}` as Hex;
const market: MarketConfig = { protocol: 'uniswap-v3', token, quote, tokenDecimals: 18, quoteDecimals: 18, tokenIs0: true, pool: venue };
function log(topics: Hex[], data: Hex): Log { return { address: venue, topics: topics as [Hex, ...Hex[]], data, blockNumber: 5n,
  blockHash: id, transactionHash: id, transactionIndex: 0, logIndex: 2, removed: false }; }
test('V3 negative token delta is a buy and decimal normalization is exact at a unit ratio', () => {
  const l = log(encodeEventTopics({ abi: V3, eventName: 'Swap', args: { sender: token, recipient: quote } }) as Hex[],
    encodeAbiParameters([{ type: 'int256' }, { type: 'int256' }, { type: 'uint160' }, { type: 'uint128' }, { type: 'int24' }], [-(10n ** 18n), 2n * 10n ** 18n, 2n ** 96n, 1n, 0]));
  const t = decodeSwap(l, market, 1, 1000)!;
  assert.equal(t.side, 'buy'); assert.equal(t.tokenAmount, 1); assert.equal(t.quoteAmount, 2); assert.equal(t.price, 1);
  assert.equal(decodeSwap({ ...l, removed: true }, market, 1, 1000), null);
  assert.equal(spotFromSqrt(2n ** 96n, true, 18, 6), 1e12);
  assert.equal(spotFromSqrt(2n ** 96n, false, 6, 18), 1e-12);
});
test('V4 positive caller token delta is a buy; other pools are excluded', () => {
  const m: MarketConfig = { ...market, protocol: 'pons-v2', pool: undefined, manager: venue, poolId: id };
  const l = log(encodeEventTopics({ abi: V4, eventName: 'Swap', args: { id, sender: token } }) as Hex[],
    encodeAbiParameters([{ type: 'int128' }, { type: 'int128' }, { type: 'uint160' }, { type: 'uint128' }, { type: 'int24' }, { type: 'uint24' }], [10n ** 18n, -2n * 10n ** 18n, 2n ** 96n, 1n, 0, 3000]));
  assert.equal(decodeSwap(l, m, 1, 1000)!.side, 'buy');
  assert.equal(decodeSwap(l, { ...m, poolId: `0x${'22'.repeat(32)}` }, 1, 1000), null);
});
test('curve uses post-block reserves and explicitly labels a graduation execution-ratio fallback', () => {
  const l = log(encodeEventTopics({ abi: CURVE, eventName: 'CurveBuy', args: { buyer: token, recipient: quote } }) as Hex[],
    encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], [2n * 10n ** 18n, 10n ** 18n, 1n, 2n]));
  const m: MarketConfig = { ...market, protocol: 'pons-v2', pool: undefined, curve: venue };
  assert.equal(decodeSwap(l, m, 1, 1000, 1.5)!.price, 1.5);
  const fallback = decodeSwap(l, m, 1, 1000)!;
  assert.equal(fallback.price, 2); assert.match(fallback.raw.priceBasis, /effective execution/);
  assert.equal(fallback.raw.feeRaw, '1');
});
