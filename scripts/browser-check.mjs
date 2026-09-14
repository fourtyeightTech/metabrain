import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import packagedChromium from '@sparticuz/chromium';

// Test-only server/browser. No deployment and no connections to a live token.
const out = new URL('../artifacts/browser/', import.meta.url);
await mkdir(out, { recursive: true });
const processes = []; let browser;
async function server(port, mode) {
  let log = '';
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '--hostname', '127.0.0.1'], {
    env: { ...process.env, TRAY_MODE: mode, DATABASE_URL: '', DATABASE_READ_URL: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  processes.push(child); child.stdout.on('data', x => { log += x; }); child.stderr.on('data', x => { log += x; });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.status === 200 || r.status === 503) return; } catch { /* starting */ }
    if (child.exitCode !== null) throw new Error(log);
    await delay(150);
  }
  throw new Error(`Server did not start: ${log}`);
}
try {
  await server(3100, 'demo');
  const executablePath = process.env.BROWSER_EXECUTABLE_PATH || await packagedChromium.executablePath();
  browser = await chromium.launch({ executablePath, headless: true, args: [
    ...packagedChromium.args, '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'
  ] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:3100', { waitUntil: 'networkidle' });
  await page.getByText('Synthetic market replay', { exact: true }).waitFor();
  await page.locator('.cortex-canvas canvas').waitFor();
  await page.screenshot({ path: new URL('desktop.png', out).pathname, fullPage: true });
  await page.screenshot({ path: new URL('hero.png', out).pathname });
  await page.getByRole('button', { name: 'Pause camera rotation' }).click();
  await page.getByRole('button', { name: 'Resume camera rotation' }).waitFor();
  await page.getByRole('tab', { name: 'Stimulus', exact: true }).click();
  await page.getByRole('heading', { name: 'What the model receives.' }).waitFor();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'The prediction receipt.' }).waitFor();
  await page.getByRole('tab', { name: '3D cortex', exact: true }).click();
  await page.locator('.cortex-canvas canvas').waitFor();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  assert.equal(await page.locator('tbody tr').count(), 8);
  await page.getByRole('button', { name: 'Pause view' }).click();
  await page.getByRole('button', { name: 'Resume view' }).waitFor();
  await page.locator('tbody tr').first().click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('combobox').selectOption('cortical');
  await page.getByText('No paper decisions. Observer mode holds cash; cortical mode requires a fresh model prediction.').waitFor();
  assert.equal(await page.getByText('NO PREDICTION', { exact: true }).count(), 1);
  await page.getByRole('combobox').selectOption('observer');
  await page.getByText('Observes the market and maintains a cash-only paper account.').waitFor();
  await page.getByRole('button', { name: '75 TX', exact: true }).click();
  assert.match(await page.getByRole('button', { name: '75 TX', exact: true }).getAttribute('class'), /selected/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export receipt' }).click();
  const download = await downloadPromise; const stream = await download.createReadStream();
  let receipt = ''; for await (const part of stream) receipt += part;
  const parsed = JSON.parse(receipt); assert.equal(parsed.snapshot.mode, 'demo'); assert.equal(parsed.prediction, null);
  await nav.getByRole('button', { name: 'The science', exact: true }).click();
  await page.getByRole('heading', { name: 'Timing and uncertainty' }).waitFor();
  await nav.getByRole('button', { name: 'Deployment', exact: true }).click();
  await page.getByRole('heading', { name: 'Three services. One observatory.' }).waitFor();
  await nav.getByRole('button', { name: 'Observatory', exact: true }).click();
  await page.getByRole('button', { name: 'Reset replay' }).click();
  await page.getByRole('button', { name: 'Reset brain view' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: new URL('mobile.png', out).pathname, fullPage: true });
  await page.screenshot({ path: new URL('mobile-hero.png', out).pathname });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'Mobile page overflows horizontally');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Resume camera rotation' }).waitFor();
  await page.locator('summary').filter({ hasText: 'Is this a real human brain?' }).click();
  await page.locator('.faq-items details[open]').waitFor();
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Page overflows at ${width}px`);
  }
  const health = await (await fetch('http://127.0.0.1:3100/api/health')).json(); assert.equal(health.status, 'demo');
  assert.equal((await fetch('http://127.0.0.1:3100/api/predictions/not-an-id')).status, 400);
  assert.equal((await fetch('http://127.0.0.1:3100/api/mesh')).status, 404);
  await server(3101, 'live');
  const unavailable = await fetch('http://127.0.0.1:3101/api/snapshot');
  assert.equal(unavailable.status, 503); assert.ok(!(await unavailable.json()).ticks);
  assert.deepEqual(errors, []);
  const report = { status: 'passed', viewport: ['1440x1100', '390x844', '320x1000', '768x1000', '1024x1000'],
    checks: ['production render', '3D schematic', 'hero viewer tabs and arrow keys', 'camera rotation and reduced motion', 'FAQ expansion', 'paper policy controls', 'pause/reset', 'event modal and Escape',
      'chart range', 'receipt download', 'science/deployment tabs', 'mobile overflow', 'API mode boundaries'],
    realChainTested: false, realTribeTested: false };
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close(); for (const child of processes) child.kill('SIGTERM');
}
