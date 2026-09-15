import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { decodeSurfaceFrames, SURFACE_FRAME_HEADER_BYTES, SURFACE_FRAME_MAGIC } from '../src/lib/surface-frames';
import { storedSurfaceFrames } from '../src/lib/server/surface';
import type { Sql } from '../src/lib/server/db';

const predictionId = '00000000-0000-4000-8000-000000000009';

function rawFixture(vertexCount = 3) {
  const frameCount = 2;
  const bytes = new Uint8Array(SURFACE_FRAME_HEADER_BYTES + frameCount * 8 + vertexCount * frameCount * 2);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(SURFACE_FRAME_MAGIC));
  view.setUint16(8, 1, true); view.setUint16(10, 1, true); view.setUint32(12, SURFACE_FRAME_HEADER_BYTES, true);
  view.setUint32(16, vertexCount, true); view.setUint32(20, frameCount, true); view.setFloat32(24, 2, true);
  let offset = 32;
  for (const value of [1, 2]) { view.setFloat32(offset, value, true); offset += 4; }
  for (const value of [.5, .75]) { view.setFloat32(offset, value, true); offset += 4; }
  for (let index = 0; index < vertexCount * frameCount; index++) {
    const fixture = [-32767, 0, 32767, 16384, -16384, 8192];
    view.setInt16(offset, fixture[index % fixture.length], true); offset += 2;
  }
  return bytes;
}

test('versioned surface frames preserve real timing, vertex order and fixed display scale', () => {
  const metadata = {
    version: 1, format: 'metatray-surface-int16-le', compression: 'gzip',
    quantization: 'signed-int16-fixed-symmetric', timing: 'upstream-segment-start-duration-seconds',
    frameCount: 2, vertexCount: 3, colorLimit: 2, byteLength: 1, sha256: '0'.repeat(64)
  } as const;
  const decoded = decodeSurfaceFrames(rawFixture().buffer, metadata);
  assert.deepEqual([...decoded.starts], [1, 2]); assert.deepEqual([...decoded.durations], [.5, .75]);
  assert.deepEqual([...decoded.frame(0)], [-2, 0, 2]);
  const second = decoded.frame(1);
  assert.ok(Math.abs(second[0] - 1.00003) < .0001); assert.ok(Math.abs(second[1] + 1.00003) < .0001);
  assert.throws(() => decoded.frame(2), /out of bounds/);
  assert.throws(() => decodeSurfaceFrames(rawFixture().slice(0, -1)), /length/);
  const reserved = rawFixture(); new DataView(reserved.buffer).setInt16(48, -32768, true);
  assert.throws(() => decodeSurfaceFrames(reserved), /reserved/);
  assert.throws(() => decodeSurfaceFrames(rawFixture(), { ...metadata, compression: 'gzip', sha256: 'invalid' }), /metadata/);
});

test('TypeScript decoder consumes the deterministic Python encoder golden vector', async () => {
  const fixture = JSON.parse(await readFile(new URL('./data/surface-frame-v1.json', import.meta.url), 'utf8')) as {
    payloadBase64: string; sha256: string; frameCount: number; vertexCount: number; colorLimit: number;
    starts: number[]; durations: number[]; frames: number[][];
  };
  const compressed = Buffer.from(fixture.payloadBase64, 'base64');
  assert.equal(createHash('sha256').update(compressed).digest('hex'), fixture.sha256);
  const decoded = decodeSurfaceFrames(gunzipSync(compressed));
  assert.equal(decoded.frameCount, fixture.frameCount); assert.equal(decoded.vertexCount, fixture.vertexCount);
  assert.equal(decoded.colorLimit, fixture.colorLimit); assert.deepEqual([...decoded.starts], fixture.starts);
  assert.deepEqual([...decoded.durations], fixture.durations);
  fixture.frames.forEach((frame, index) => assert.deepEqual([...decoded.frame(index)].map(value => Number(value.toFixed(8))), frame));
});

test('migration 002 stores an integrity-checked compact payload and cascades orphan cleanup', async () => {
  const pg = new PGlite(); const db = pg as unknown as Sql;
  await pg.exec(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  const migration = await readFile(new URL('../db/002_surface_frames.sql', import.meta.url), 'utf8');
  await pg.exec(migration); await pg.exec(migration);
  const raw = rawFixture(20484); const payload = gzipSync(raw, { level: 9 });
  const digest = createHash('sha256').update(payload).digest('hex');
  await db.query("INSERT INTO metatray_jobs(id,input_hash,input,input_end,source_block,status) VALUES($1,'surface-fixture','{}',1,1,'complete')", [predictionId]);
  await db.query("INSERT INTO metatray_predictions(id,input_end,available_at,summary,result) VALUES($1,1,2,'{}','{}')", [predictionId]);
  await db.query(`INSERT INTO metatray_prediction_surfaces
    (prediction_id,format,version,compression,frame_count,vertex_count,color_limit,sha256,byte_length,payload)
    VALUES($1,'metatray-surface-int16-le',1,'gzip',2,20484,2,$2,$3,$4)`, [predictionId, digest, payload.byteLength, payload]);
  const stored = await storedSurfaceFrames(db, predictionId);
  assert.ok(stored); assert.equal(stored.sha256, digest); assert.deepEqual([...gunzipSync(stored.payload)], [...raw]);
  const corrupted = Buffer.from(payload); corrupted[corrupted.length - 1] ^= 1;
  await db.query('UPDATE metatray_prediction_surfaces SET payload=$2 WHERE prediction_id=$1', [predictionId, corrupted]);
  await assert.rejects(() => storedSurfaceFrames(db, predictionId), /failed validation/);
  await db.query('UPDATE metatray_prediction_surfaces SET payload=$2 WHERE prediction_id=$1', [predictionId, payload]);
  await db.query('DELETE FROM metatray_predictions WHERE id=$1', [predictionId]);
  assert.equal((await db.query('SELECT * FROM metatray_prediction_surfaces')).rows.length, 0);
  assert.deepEqual((await db.query<{ version: string }>('SELECT version FROM metatray_migrations ORDER BY version')).rows.map(row => row.version), ['001', '002']);
  await pg.close();
});
