import { NextResponse } from 'next/server';
import { demoSnapshot } from '@/lib/demo';
import { getLiveFeed } from '@/lib/server/live-feed';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.METATRAY_MODE === 'demo') {
    const params = new URL(request.url).searchParams;
    const step = Math.min(1200, Math.max(40, Number(params.get('step')) || 180));
    const policy = params.get('policy');
    return NextResponse.json(demoSnapshot(Math.floor(step), policy === 'observer' || policy === 'cortical' ? policy : 'momentum'), { headers });
  }
  const snapshot = await getLiveFeed();
  return NextResponse.json(snapshot, { status: snapshot.connected ? 200 : 503, headers });
}
