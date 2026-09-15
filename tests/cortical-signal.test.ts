import test from 'node:test';
import assert from 'node:assert/strict';
import { marketSignalPosition, marketSignalStrength, takeUnseenRecentSignals } from '../src/lib/cortical-signal';
import type { Tick } from '../src/lib/types';

test('public event receipts map deterministically to bounded, distinct 3D signal points', () => {
  const first = marketSignalPosition({ txHash: `0x${'11'.repeat(32)}`, blockNumber: 10, logIndex: 0 });
  const again = marketSignalPosition({ txHash: `0x${'11'.repeat(32)}`, blockNumber: 10, logIndex: 0 });
  const second = marketSignalPosition({ txHash: `0x${'ab'.repeat(32)}`, blockNumber: 11, logIndex: 2 });
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, second);
  for (const coordinate of [...first, ...second]) assert.ok(Number.isFinite(coordinate));
  assert.ok(Math.abs(first[0]) <= 44 && Math.abs(first[1]) <= 31 && Math.abs(first[2]) <= 39);
  assert.ok(Math.abs(second[0]) <= 44 && Math.abs(second[1]) <= 31 && Math.abs(second[2]) <= 39);
});

function signal(id: string, ts: number): Tick {
  return { id, ts, txHash: `0x${id.padStart(64, '0')}`, blockNumber: 10, blockHash: `0x${'ab'.repeat(32)}`,
    logIndex: Number(id), side: 'buy', price: 1, quoteAmount: 1, tokenAmount: 1, venue: 'uniswap-v3', raw: {} };
}

test('recent market signals never replay after their visible pulse expires or a view resumes', () => {
  const now = 1_000_000; const seen = new Map<string, number>(); const first = signal('1', now - 1_000);
  assert.deepEqual(takeUnseenRecentSignals([first], seen, now).map(event => event.id), ['1']);

  const second = signal('2', now + 9_000);
  assert.deepEqual(takeUnseenRecentSignals([first, second], seen, now + 10_000).map(event => event.id), ['2']);
  assert.deepEqual(takeUnseenRecentSignals([first, second], seen, now + 11_000), []);
});

test('events omitted from a visual burst are still marked seen', () => {
  const now = 2_000_000; const seen = new Map<string, number>();
  const events = Array.from({ length: 8 }, (_, index) => signal(String(index + 1), now - 1_000));
  assert.deepEqual(takeUnseenRecentSignals(events, seen, now, 2).map(event => event.id), ['7', '8']);
  assert.deepEqual(takeUnseenRecentSignals(events, seen, now + 1_000, 2), []);
});

test('market signal strength is unit-agnostic, ordered and conservatively bounded', () => {
  const window = [{ quoteAmount: 1 }, { quoteAmount: 10 }, { quoteAmount: 1_000 }];
  const small = marketSignalStrength(window[0], window); const medium = marketSignalStrength(window[1], window);
  const large = marketSignalStrength(window[2], window);
  assert.ok(small >= 0.75 && large <= 1.25);
  assert.ok(small < medium && medium < large);
  const scaled = window.map(event => ({ quoteAmount: event.quoteAmount * 1_000_000 }));
  assert.ok(Math.abs(medium - marketSignalStrength(scaled[1], scaled)) < Number.EPSILON * 8);
  assert.equal(marketSignalStrength({ quoteAmount: 10 }, [{ quoteAmount: 10 }]), 1);
  assert.equal(marketSignalStrength({ quoteAmount: Number.NaN }, window), 1);
});
