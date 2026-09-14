import { NextResponse } from 'next/server';
import { getLiveFeed } from '@/lib/server/live-feed';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.METATRAY_MODE === 'demo') return NextResponse.json({ status: 'demo', model: 'not-connected', chain: 'synthetic' }, { headers });
  const snapshot = await getLiveFeed();
  return NextResponse.json({ status: snapshot.connected ? 'ok' : 'degraded', feed: snapshot.feed,
    model: snapshot.prediction ? 'result-available' : 'not-connected', message: snapshot.message },
    { status: snapshot.connected ? 200 : 503, headers });
}
