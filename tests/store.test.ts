import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyBlock, queueInference, recentTicks, rewind } from '../src/lib/server/store';
import { getState, type Sql } from '../src/lib/server/db';
import { DEFAULT_PAPER_CONFIG, type PaperAccount } from '../src/lib/types';
import { at, tick } from './fixtures';

test('PostgreSQL migration, idempotent blocks, canonical parent enforcement, job queue and reorg rollback', async () => {
  const pg = new PGlite(); const db = pg as unknown as Sql;
  await pg.exec(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  const cfg = { ...DEFAULT_PAPER_CONFIG, policy: 'momentum' as const };
  const first = { number: 1, hash: 'a', parentHash: 'zero', ts: at, ticks: [tick(1, 0, 1)] };
  assert.equal(await applyBlock(db, first, cfg, at), true);
  assert.equal(await applyBlock(db, first, cfg, at), false);
  assert.equal((await recentTicks(db)).length, 1);
  await assert.rejects(() => applyBlock(db, { ...first, hash: 'wrong' }, cfg, at), /REORG_REQUIRED/);
  await assert.rejects(() => applyBlock(db, { number: 2, hash: 'b', parentHash: 'wrong', ts: at + 15000, ticks: [] }, cfg, at), /NON_CANONICAL_PARENT/);
  await applyBlock(db, { number: 2, hash: 'b', parentHash: 'a', ts: at + 15000, ticks: [tick(1, 15, 2)] }, cfg, at + 15000);
  await applyBlock(db, { number: 3, hash: 'c', parentHash: 'b', ts: at + 30000, ticks: [tick(1.1, 30, 3)] }, cfg, at + 30000);
  assert.equal((await getState<PaperAccount>(db, 'paper'))!.fills.length, 1);
  const options = { now: at + 30001, contextSeconds: 100, refreshSeconds: 15, quote: 'DEMO' };
  await queueInference(db, options); await queueInference(db, options);
  const jobs = (await db.query<{ id: string; input: { ticks: { ts: number }[]; end: number } }>('SELECT id,input FROM metatray_jobs')).rows;
  assert.equal(jobs.length, 1); assert.ok(jobs[0].input.ticks.every(t => t.ts <= jobs[0].input.end));
  await db.query("UPDATE metatray_jobs SET status='running',lease_id='00000000-0000-4000-8000-000000000002' WHERE id=$1", [jobs[0].id]);
  await db.query("INSERT INTO metatray_predictions(id,input_end,available_at,summary,result) VALUES($1,$2,$2,'{}','{}')", [jobs[0].id, at + 30001]);
  await pg.transaction(async tx => rewind(tx as unknown as Sql, 2, cfg.initialQuote));
  assert.equal((await recentTicks(db)).length, 2);
  assert.equal((await getState<PaperAccount>(db, 'paper'))!.fills.length, 0);
  assert.equal((await db.query('SELECT * FROM metatray_predictions')).rows.length, 0);
  const cancelled = (await db.query('SELECT status,lease_id FROM metatray_jobs')).rows[0];
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.lease_id, null);
  await applyBlock(db, { number: 3, hash: 'replacement', parentHash: 'b', ts: at + 30000, ticks: [tick(.9, 30, 3)] }, cfg, at + 30000);
  assert.equal((await recentTicks(db)).at(-1)!.price, .9);
  await pg.close();
});
test('historical catch-up never backdates paper trades', async () => {
  const pg = new PGlite(); const db = pg as unknown as Sql;
  await pg.exec(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  let parent = 'zero';
  for (let i = 1; i <= 3; i++) {
    await applyBlock(db, { number: i, hash: String(i), parentHash: parent, ts: at + i * 30000, ticks: [tick(i, i * 30, i)] },
      { ...DEFAULT_PAPER_CONFIG, policy: 'momentum' }, at + 600000);
    parent = String(i);
  }
  assert.equal((await getState<PaperAccount>(db, 'paper'))!.fills.length, 0);
  await pg.close();
});
test('a pre-window seed cannot queue a model job or alter in-window narration', async () => {
  const pg = new PGlite(); const db = pg as unknown as Sql;
  await pg.exec(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  const cfg = { ...DEFAULT_PAPER_CONFIG, policy: 'observer' as const };
  await applyBlock(db, { number: 1, hash: 'seed', parentHash: 'zero', ts: at,
    ticks: [tick(.1, 0, 1)] }, cfg, at);
  await applyBlock(db, { number: 2, hash: 'fresh-a', parentHash: 'seed', ts: at + 120000,
    ticks: [tick(1, 120, 2)] }, cfg, at + 120000);
  await applyBlock(db, { number: 3, hash: 'fresh-b', parentHash: 'fresh-a', ts: at + 130000,
    ticks: [tick(1.1, 130, 3)] }, cfg, at + 130000);
  await queueInference(db, { now: at + 130001, contextSeconds: 100, refreshSeconds: 15, quote: 'TEST' });
  const job = (await db.query<{ input: { baselineTickId: string; windowEventCount: number; text: string } }>('SELECT input FROM metatray_jobs')).rows[0];
  assert.equal(job.input.baselineTickId, tick(.1, 0, 1).id); assert.equal(job.input.windowEventCount, 2);
  assert.match(job.input.text, /risen 10\.00 percent/); assert.doesNotMatch(job.input.text, /1000\.00 percent/);

  await db.query('DELETE FROM metatray_jobs'); await db.query('UPDATE metatray_state SET value=\'0\'::jsonb WHERE key=\'lastJobAt\'');
  await applyBlock(db, { number: 4, hash: 'quiet', parentHash: 'fresh-b', ts: at + 300000, ticks: [] }, cfg, at + 300000);
  await queueInference(db, { now: at + 300001, contextSeconds: 100, refreshSeconds: 15, quote: 'TEST' });
  assert.equal((await db.query('SELECT * FROM metatray_jobs')).rows.length, 0);
  await pg.close();
});
