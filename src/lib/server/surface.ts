import { createHash } from 'node:crypto';
import type { Sql } from './db';

export interface StoredSurfaceFrames {
  predictionId: string; format: 'metatray-surface-int16-le'; version: 1; compression: 'gzip';
  frameCount: number; vertexCount: number; colorLimit: number; sha256: string; byteLength: number; payload: Uint8Array;
}

interface SurfaceRow {
  prediction_id: string; format: string; version: number; compression: string;
  frame_count: number; vertex_count: number; color_limit: number; sha256: string; byte_length: number;
  payload: Uint8Array;
}

export async function storedSurfaceFrames(db: Sql, predictionId: string): Promise<StoredSurfaceFrames | null> {
  const row = (await db.query<SurfaceRow>(`SELECT prediction_id,format,version,compression,frame_count,vertex_count,
    color_limit,sha256,byte_length,payload FROM metatray_prediction_surfaces WHERE prediction_id=$1`, [predictionId])).rows[0];
  if (!row) return null;
  const payload = new Uint8Array(row.payload);
  const valid = row.format === 'metatray-surface-int16-le' && row.version === 1 && row.compression === 'gzip'
    && Number.isInteger(row.frame_count) && row.frame_count >= 2 && row.frame_count <= 512
    && row.vertex_count === 20484
    && row.color_limit === 2
    && row.byte_length === payload.byteLength && payload.byteLength <= 16 * 1024 * 1024
    && /^[0-9a-f]{64}$/.test(row.sha256)
    && createHash('sha256').update(payload).digest('hex') === row.sha256;
  if (!valid) throw new Error('Stored surface frame payload failed validation');
  return { predictionId: row.prediction_id, format: 'metatray-surface-int16-le', version: 1, compression: 'gzip',
    frameCount: row.frame_count, vertexCount: row.vertex_count, colorLimit: row.color_limit,
    sha256: row.sha256, byteLength: row.byte_length, payload };
}
