import type { Tick } from './types';

export const MARKET_SIGNAL_RECENCY_MS = 90_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 30_000;
const SEEN_SIGNAL_RETENTION_MS = MARKET_SIGNAL_RECENCY_MS * 2;
const MAX_SEEN_SIGNALS = 256;

type SignalIdentity = Pick<Tick, 'id' | 'txHash' | 'ts'>;
type SignalMagnitude = Pick<Tick, 'quoteAmount'>;

export function isRecentMarketSignal(event: Pick<Tick, 'txHash' | 'ts'> | undefined, now = Date.now()): boolean {
  return !!event?.txHash && Number.isFinite(event.ts) && event.ts <= now + MAX_FUTURE_CLOCK_SKEW_MS && now - event.ts < MARKET_SIGNAL_RECENCY_MS;
}

/** Maps relative trade size to a deliberately narrow visual range. */
export function marketSignalStrength(event: SignalMagnitude, window: readonly SignalMagnitude[]): number {
  const amounts = window.map(item => item.quoteAmount).filter(amount => Number.isFinite(amount) && amount > 0);
  if (!Number.isFinite(event.quoteAmount) || event.quoteAmount <= 0 || amounts.length < 2) return 1;
  const low = Math.min(...amounts); const high = Math.max(...amounts);
  if (low === high) return 1;
  const normalized = (Math.log(event.quoteAmount) - Math.log(low)) / (Math.log(high) - Math.log(low));
  return 0.75 + Math.min(1, Math.max(0, normalized)) * 0.5;
}

/**
 * Returns only genuinely new recent events while retaining a bounded history
 * beyond the visible pulse lifetime. This prevents a completed pulse from
 * replaying when another event arrives or the live view is paused and resumed.
 */
export function takeUnseenRecentSignals<T extends SignalIdentity>(
  events: readonly T[],
  seen: Map<string, number>,
  now = Date.now(),
  limit = 6
): T[] {
  for (const [id, seenAt] of seen) {
    if (now - seenAt >= SEEN_SIGNAL_RETENTION_MS) seen.delete(id);
  }

  const unseen: T[] = [];
  for (const event of events) {
    if (!isRecentMarketSignal(event, now) || seen.has(event.id)) continue;
    seen.set(event.id, now);
    unseen.push(event);
  }

  while (seen.size > MAX_SEEN_SIGNALS) {
    const oldest = seen.keys().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }

  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return count ? unseen.slice(-count) : [];
}

/** Maps a public event receipt to a stable point on the illustrative cortical field. */
export function marketSignalPosition(tick: Pick<Tick, 'txHash' | 'blockNumber' | 'logIndex'>): [number, number, number] {
  const hex = tick.txHash.replace(/^0x/, '').padEnd(16, '0');
  const first = Number.parseInt(hex.slice(0, 8), 16) || tick.blockNumber;
  const second = Number.parseInt(hex.slice(8, 16), 16) || tick.logIndex + 1;
  const hemisphere = first % 2 ? 1 : -1;
  const latitude = ((first % 1000) / 999 - 0.5) * Math.PI * 0.86;
  const longitude = ((second % 1000) / 999 - 0.5) * Math.PI * 1.35;
  return [hemisphere * 23 + hemisphere * Math.cos(latitude) * Math.cos(longitude) * 21,
    Math.sin(latitude) * 31, Math.cos(latitude) * Math.sin(longitude) * 39];
}
