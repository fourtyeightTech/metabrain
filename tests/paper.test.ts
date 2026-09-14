import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAccount, equity, predictionUsable, stepPaper } from '../src/lib/paper';
import { DEFAULT_PAPER_CONFIG } from '../src/lib/types';
import { at, tick, prediction } from './fixtures';

const cfg = { ...DEFAULT_PAPER_CONFIG, policy: 'momentum' as const };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test('buys debit cash, include fees in cost basis, and account for slippage', () => {
  const a = stepPaper(emptyAccount(), [tick(1, 0), tick(1, 15), tick(1.1, 30)], cfg, null, at + 30000);
  const fill = a.fills[0]; assert.equal(fill.side, 'buy');
  near(a.cash + fill.notional + fill.fee, 10000); near(a.costBasis, fill.notional + fill.fee);
  near(a.units * fill.price, fill.notional); assert.ok(fill.price > 1.1);
  assert.ok(equity(a, 1.1) < 10000); assert.ok(a.units * 1.1 / equity(a, 1.1) <= .25);
});
test('round-trip realized P/L equals the net cash change, with zero residual basis', () => {
  const history = [tick(1, 0), tick(1, 15), tick(1.1, 30)];
  const bought = stepPaper(emptyAccount(), history, cfg, null, at + 30000);
  const sold = stepPaper(bought, [...history, tick(.9, 60)], cfg, null, at + 60000);
  assert.equal(sold.units, 0); assert.equal(sold.costBasis, 0); assert.equal(sold.fills.length, 2);
  near(sold.realizedPnl, sold.cash - 10000); assert.ok(sold.totalFees > bought.totalFees);
});
test('future, missing, invalid and stale predictions cannot authorize cortical decisions', () => {
  const now = at + 30000; const p = prediction(now); const cortical = { ...cfg, policy: 'cortical' as const };
  const history = [tick(1, 0), tick(1, 15), tick(1.1, 30)];
  for (const bad of [null, { ...p, availableAt: now + 1 }, { ...p, inputEnd: now + 1 },
    { ...p, inputEnd: now - 46000 }, { ...p, responseChange: null }, { ...p, responseChange: NaN }]) {
    assert.equal(predictionUsable(bad, now, 45000), false);
    assert.equal(stepPaper(emptyAccount(), history, cortical, bad, now).fills.length, 0);
  }
  const realContractFixture = stepPaper(emptyAccount(), history, cortical, p, now);
  assert.equal(realContractFixture.fills[0].predictionId, p.id);
  assert.ok(realContractFixture.units * 1.1 / equity(realContractFixture, 1.1) < .126);
});
test('observer holds cash, future ticks are ignored, cooldown prevents repeat fills', () => {
  const history = [tick(1, 0), tick(1, 15), tick(1.1, 30)];
  assert.equal(stepPaper(emptyAccount(), history, DEFAULT_PAPER_CONFIG, null, at + 30000).fills.length, 0);
  assert.equal(stepPaper(emptyAccount(), history, cfg, null, at + 29999).fills.length, 0);
  const bought = stepPaper(emptyAccount(), history, cfg, null, at + 30000);
  assert.equal(stepPaper(bought, [...history, tick(.7, 31)], cfg, null, at + 31000).fills.length, 1);
});
test('a long price path never spends unowned cash or sells unowned units', () => {
  const history = []; let a = emptyAccount();
  for (let i = 0; i < 500; i++) {
    history.push(tick(Math.exp(Math.sin(i / 5)), i * 5));
    a = stepPaper(a, history, cfg, null, at + i * 5000);
    assert.ok(a.cash >= -1e-8); assert.ok(a.units >= 0); assert.ok(a.costBasis >= -1e-8);
    assert.ok(Number.isFinite(equity(a, history.at(-1)!.price)));
  }
});
