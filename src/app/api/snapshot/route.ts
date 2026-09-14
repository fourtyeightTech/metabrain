import { NextResponse } from 'next/server';
import { demoSnapshot } from '@/lib/demo';
import { liveSnapshot } from '@/lib/server/snapshot';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.TRAY_MODE !== 'live') {
    const params = new URL(request.url).searchParams;
    const step = Math.min(1200, Math.max(40, Number(params.get('step')) || 180));
    const policy = params.get('policy');
    return NextResponse.json(demoSnapshot(Math.floor(step), policy === 'observer' || policy === 'cortical' ? policy : 'momentum'), { headers });
  }
  try { return NextResponse.json(await liveSnapshot(), { headers }); }
  catch { return NextResponse.json({ error: 'Live data unavailable. Check the database migration and indexer service.' }, { status: 503, headers }); }
}
