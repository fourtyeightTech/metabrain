import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { storedSurfaceFrames } from '@/lib/server/surface';
import { SURFACE_FRAME_MIME } from '@/lib/surface-frames';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    return NextResponse.json({ error: 'Invalid result ID' }, { status: 400 });
  if (process.env.METATRAY_MODE === 'demo') return NextResponse.json({ error: 'Demo contains no model surfaces' }, { status: 404 });
  try {
    const surface = await storedSurfaceFrames(pool(true), id);
    if (!surface) return NextResponse.json({ error: 'Temporal surface unavailable or source history orphaned' }, { status: 404 });
    const body = new ArrayBuffer(surface.payload.byteLength);
    new Uint8Array(body).set(surface.payload);
    return new NextResponse(body, { headers: {
      'Content-Type': `${SURFACE_FRAME_MIME}; version=${surface.version}`,
      'Content-Encoding': surface.compression,
      'Cache-Control': 'no-store',
      'ETag': `"${surface.sha256}"`,
      'Vary': 'Accept-Encoding',
      'X-MetaTray-Surface-Format': surface.format,
      'X-MetaTray-Surface-Frames': String(surface.frameCount),
      'X-MetaTray-Surface-Vertices': String(surface.vertexCount)
    } });
  } catch {
    return NextResponse.json({ error: 'Temporal surface store unavailable' }, { status: 503 });
  }
}
