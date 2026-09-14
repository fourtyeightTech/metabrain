import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return NextResponse.json({ error: 'Invalid result ID' }, { status: 400 });
  if (process.env.TRAY_MODE !== 'live') return NextResponse.json({ error: 'Demo contains no model predictions' }, { status: 404 });
  try {
    const { rows } = await pool(true).query('SELECT result FROM tray_predictions WHERE id=$1', [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Prediction unavailable or source history orphaned' }, { status: 404 });
    return NextResponse.json(rows[0].result, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Prediction store unavailable' }, { status: 503 }); }
}
