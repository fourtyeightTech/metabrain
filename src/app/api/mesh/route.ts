import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.TRAY_MODE !== 'live') return NextResponse.json({ error: 'Anatomical mesh requires the inference worker' }, { status: 404 });
  try {
    const { rows } = await pool(true).query("SELECT data FROM tray_assets WHERE key='fsaverage5'");
    if (!rows[0]) return NextResponse.json({ error: 'Anatomical mesh not yet available' }, { status: 404 });
    return NextResponse.json(rows[0].data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch { return NextResponse.json({ error: 'Mesh unavailable' }, { status: 503 }); }
}
