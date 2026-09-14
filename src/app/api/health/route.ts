import { NextResponse } from 'next/server';
import { pool, getState } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.TRAY_MODE !== 'live') return NextResponse.json({ status: 'demo', model: 'not-connected', chain: 'synthetic' });
  try {
    const health = await getState<{ heartbeat: number; ok: boolean }>(pool(true), 'health');
    const ok = !!health?.ok && Date.now() - health.heartbeat < 15000;
    return NextResponse.json({ status: ok ? 'ok' : 'degraded', database: 'reachable', indexer: ok ? 'fresh' : 'stale' }, { status: ok ? 200 : 503 });
  } catch { return NextResponse.json({ status: 'degraded', database: 'unavailable' }, { status: 503 }); }
}
