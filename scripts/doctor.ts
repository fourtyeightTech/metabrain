import 'dotenv/config';
import { liveConfig, paperConfig } from '../src/lib/server/config';
import { discoverMarket, makeClient } from '../src/lib/server/chain';
import { pool } from '../src/lib/server/db';
import type { PublicClient } from 'viem';

if (process.env.TRAY_MODE !== 'live') {
  console.log('Demo mode: no RPC, database or GPU is required. Build with npm run build.');
} else {
  try {
    const cfg = liveConfig(); paperConfig();
    const db = pool();
    await db.query("SELECT version FROM tray_migrations WHERE version='001'");
    const client = makeClient(cfg) as PublicClient;
    const market = await discoverMarket(client, cfg);
    const head = await client.getBlockNumber();
    if (BigInt(cfg.TOKEN_START_BLOCK) > head) throw new Error('Start block exceeds current chain head');
    // Contract addresses are public metadata; endpoints and database URLs are never printed.
    console.log(JSON.stringify({ status: 'read-services-verified', chainId: cfg.CHAIN_ID, head: head.toString(),
      market, paperPolicy: paperConfig().policy, inferenceEnabled: cfg.INFERENCE_ENABLED }, null, 2));
    console.log('The live event and GPU smoke tests remain required. See docs/DEPLOYMENT.md.');
    await db.end();
  } catch (error) {
    console.error('Read-service check failed:', error instanceof Error ? error.name : 'UnknownError');
    console.error('Check required environment fields, applied migration, RPC chain and protocol deployments. No credentials were printed.');
    try { await pool().end(); } catch { /* configuration may fail before creating a pool */ }
    process.exitCode = 1;
  }
}
