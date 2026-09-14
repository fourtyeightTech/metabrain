import { DEFAULT_PAPER_CONFIG, type PaperAccount, type PaperConfig, type PredictionSummary, type Tick } from './types';

export function emptyAccount(initialQuote = DEFAULT_PAPER_CONFIG.initialQuote): PaperAccount {
  return { cash: initialQuote, units: 0, costBasis: 0, realizedPnl: 0, totalFees: 0,
    lastDecisionAt: 0, peakEquity: initialQuote, maxDrawdown: 0, fills: [] };
}
export function equity(account: PaperAccount, price: number): number {
  return account.cash + account.units * price;
}
export function predictionUsable(prediction: PredictionSummary | null, now: number, maxAge: number): boolean {
  return !!prediction && prediction.source === 'tribe-v2' && prediction.inputEnd <= prediction.availableAt
    && prediction.availableAt <= now && now - prediction.inputEnd <= maxAge
    && now - prediction.availableAt <= maxAge && prediction.responseChange !== null
    && Number.isFinite(prediction.responseChange);
}
// An authored paper strategy, not a neuroscience-derived financial policy.
// A new prediction can influence only decisions AFTER it became available.
export function stepPaper(account: PaperAccount, history: Tick[], cfg: PaperConfig,
  prediction: PredictionSummary | null, decisionAt: number): PaperAccount {
  const tick = history.at(-1);
  if (!tick || !Number.isFinite(tick.price) || tick.price <= 0 || tick.ts > decisionAt) return account;
  const next = { ...account, fills: [...account.fills] };
  const eq = equity(next, tick.price);
  next.peakEquity = Math.max(next.peakEquity, eq);
  next.maxDrawdown = Math.max(next.maxDrawdown, next.peakEquity > 0 ? 1 - eq / next.peakEquity : 0);
  if (cfg.policy === 'observer' || decisionAt - next.lastDecisionAt < cfg.minIntervalMs || history.length < 3) return next;
  const base = [...history].reverse().find(t => t.ts <= tick.ts - 30000);
  if (!base) return next;
  if (cfg.policy === 'cortical' && !predictionUsable(prediction, decisionAt, cfg.maxPredictionAgeMs)) return next;
  const momentum = tick.price / base.price - 1;
  const neuralScale = cfg.policy === 'cortical' ? Math.min(1, Math.max(0, prediction!.responseChange! / 0.1)) : 1;
  const targetWeight = momentum > 0.002 ? cfg.maxExposure * neuralScale : momentum < -0.002 ? 0 : null;
  if (targetWeight === null) return next;
  const targetValue = eq * targetWeight;
  const delta = targetValue - next.units * tick.price;
  if (Math.abs(delta) < Math.max(1e-8, eq * 0.01)) return next;
  next.lastDecisionAt = decisionAt;
  const side = delta > 0 ? 'buy' : 'sell';
  const fillPrice = tick.price * (1 + (side === 'buy' ? 1 : -1) * cfg.slippageBps / 10000);
  const feeRate = cfg.feeBps / 10000;
  let quantity: number; let notional: number; let fee: number; let realized = 0;
  if (side === 'buy') {
    notional = Math.min(delta / (1 + feeRate), next.cash / (1 + feeRate));
    if (notional <= 0) return next;
    quantity = notional / fillPrice; fee = notional * feeRate;
    next.cash -= notional + fee; next.units += quantity; next.costBasis += notional + fee;
  } else {
    quantity = Math.min(-delta / tick.price, next.units);
    if (quantity <= 0) return next;
    notional = quantity * fillPrice; fee = notional * feeRate;
    const removedBasis = next.costBasis * quantity / next.units;
    realized = notional - fee - removedBasis;
    next.cash += notional - fee; next.units -= quantity; next.costBasis -= removedBasis;
    next.realizedPnl += realized;
    if (next.units < 1e-10) { next.units = 0; next.costBasis = 0; }
  }
  next.totalFees += fee;
  next.fills.push({ id: `${tick.id}:${decisionAt}`, ts: decisionAt, side, quantity, price: fillPrice,
    notional, fee, realizedPnl: realized, tickId: tick.id,
    predictionId: cfg.policy === 'cortical' ? prediction!.id : null,
    reason: cfg.policy === 'cortical' ? 'Momentum × predicted-response-change sizing (experimental)' : '30-second momentum baseline' });
  next.fills = next.fills.slice(-300);
  return next;
}
