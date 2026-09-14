import { z } from 'zod';
import { getAddress } from 'viem';
import { DEFAULT_PAPER_CONFIG, type PaperConfig } from '../types';

const positive = (fallback: number) => z.coerce.number().finite().positive().default(fallback);
const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform(v => getAddress(v));
const schema = z.object({
  DATABASE_URL: z.string().min(1), RPC_HTTP_URL: z.string().url(), RPC_WS_URL: z.string().optional(),
  CHAIN_ID: z.coerce.number().int().positive(), TOKEN_ADDRESS: address, TOKEN_START_BLOCK: z.coerce.number().int().nonnegative(),
  MARKET_PROTOCOL: z.enum(['pons-v2', 'uniswap-v3']).default('pons-v2'),
  PONS_FACTORY_ADDRESS: address.optional(), PONS_HOOK_ADDRESS: address.optional(),
  V4_POOL_MANAGER_ADDRESS: address.optional(), V3_POOL_ADDRESS: address.optional(),
  CONFIRMATION_BLOCKS: z.coerce.number().int().min(0).max(128).default(2),
  RPC_BLOCK_BATCH: z.coerce.number().int().min(1).max(100).default(30),
  REORG_HISTORY_BLOCKS: z.coerce.number().int().min(16).max(4096).default(128),
  INFERENCE_ENABLED: z.enum(['true', 'false']).default('false'),
  INFERENCE_REFRESH_SECONDS: z.coerce.number().min(5).default(15), INFERENCE_CONTEXT_SECONDS: z.coerce.number().min(30).max(100).default(100),
  METATRAY_TOKEN_SYMBOL: z.string().max(24).default('METATRAY'), METATRAY_QUOTE_SYMBOL: z.string().max(24).default('QUOTE')
});
export function liveConfig() {
  const input = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  // No default chain/token/start block: a new project must explicitly select all three.
  for (const key of ['CHAIN_ID', 'TOKEN_START_BLOCK', 'TOKEN_ADDRESS']) if (!input[key]) throw new Error(`Missing ${key}`);
  const cfg = schema.parse(input);
  if (cfg.MARKET_PROTOCOL === 'pons-v2' && (!cfg.PONS_FACTORY_ADDRESS || !cfg.PONS_HOOK_ADDRESS || !cfg.V4_POOL_MANAGER_ADDRESS))
    throw new Error('Pons V2 needs factory, hook, and V4 pool manager addresses');
  if (cfg.MARKET_PROTOCOL === 'uniswap-v3' && !cfg.V3_POOL_ADDRESS) throw new Error('V3 pool address required');
  return cfg;
}
export type LiveConfig = ReturnType<typeof liveConfig>;
export type DiscoveryConfig = Pick<LiveConfig, 'RPC_HTTP_URL' | 'CHAIN_ID' | 'TOKEN_ADDRESS' | 'MARKET_PROTOCOL' |
  'PONS_FACTORY_ADDRESS' | 'PONS_HOOK_ADDRESS' | 'V4_POOL_MANAGER_ADDRESS' | 'V3_POOL_ADDRESS'>;

const observerSchema = schema.pick({ RPC_HTTP_URL: true, CHAIN_ID: true, TOKEN_ADDRESS: true, MARKET_PROTOCOL: true,
  PONS_FACTORY_ADDRESS: true, PONS_HOOK_ADDRESS: true, V4_POOL_MANAGER_ADDRESS: true, V3_POOL_ADDRESS: true,
  CONFIRMATION_BLOCKS: true, METATRAY_TOKEN_SYMBOL: true, METATRAY_QUOTE_SYMBOL: true }).extend({
  RPC_RECENT_BLOCKS: z.coerce.number().int().min(1).max(200).default(60),
  RPC_MAX_EVENTS: z.coerce.number().int().min(1).max(200).default(100),
  BLOCK_EXPLORER_URL: z.string().url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; }).optional()
});
export type ObserverConfig = z.infer<typeof observerSchema>;
export function observerConfiguration() {
  const input = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const required = ['RPC_HTTP_URL', 'CHAIN_ID', 'TOKEN_ADDRESS', input.MARKET_PROTOCOL === 'uniswap-v3' ? 'V3_POOL_ADDRESS' : 'PONS_FACTORY_ADDRESS'];
  const missing = required.filter(key => !input[key]);
  const parsed = observerSchema.safeParse(input);
  const invalid = parsed.success ? [] : [...new Set(parsed.error.issues.map(issue => String(issue.path[0])))].filter(key => !missing.includes(key));
  return { config: parsed.success && !missing.length ? parsed.data : null, missing, invalid };
}
export function feedSource(): 'rpc' | 'indexed' {
  if (process.env.METATRAY_FEED === 'rpc' || process.env.METATRAY_FEED === 'indexed') return process.env.METATRAY_FEED;
  return process.env.DATABASE_READ_URL || process.env.DATABASE_URL ? 'indexed' : 'rpc';
}
export function paperConfig(): PaperConfig {
  return z.object({
    initialQuote: positive(10000), feeBps: z.coerce.number().min(0).max(1000).default(30),
    slippageBps: z.coerce.number().min(0).max(1000).default(20),
    maxExposure: z.coerce.number().min(0).max(1).default(0.25),
    policy: z.enum(['observer', 'momentum', 'cortical']).default('observer'),
    minIntervalMs: positive(30000), maxPredictionAgeMs: positive(45000)
  }).parse({ ...DEFAULT_PAPER_CONFIG, initialQuote: process.env.PAPER_INITIAL_QUOTE || 10000,
    feeBps: process.env.PAPER_FEE_BPS || 30, slippageBps: process.env.PAPER_SLIPPAGE_BPS || 20,
    maxExposure: process.env.PAPER_MAX_EXPOSURE || 0.25, policy: process.env.PAPER_POLICY || 'observer',
    maxPredictionAgeMs: Number(process.env.INFERENCE_MAX_AGE_SECONDS || 45) * 1000 });
}
