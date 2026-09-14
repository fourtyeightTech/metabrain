import type { PaperAccount, Tick } from './types';

export function describeMarket(ticks: Tick[], paper: PaperAccount, quote = 'quote'): string {
  const last = ticks.at(-1);
  if (!last) return 'Waiting for an observed market price. The paper account holds cash.';
  const before = [...ticks].reverse().find(t => t.ts <= last.ts - 60000) ?? ticks[0];
  const change = (last.price / before.price - 1) * 100;
  const position = paper.units * last.price;
  const pnl = position - paper.costBasis;
  const direction = change >= 0 ? 'risen' : 'fallen';
  return `The token has ${direction} ${Math.abs(change).toFixed(2)} percent over the available recent interval. ` +
    `Its latest observed market price is ${last.price.toPrecision(6)} ${quote}. ` +
    `The simulated position is worth ${position.toFixed(2)} ${quote}. ` +
    `Its unrealized ${pnl >= 0 ? 'gain' : 'loss'} is ${Math.abs(pnl).toFixed(2)} ${quote}. ` +
    `The paper account holds ${paper.cash.toFixed(2)} ${quote} in cash.`;
}
