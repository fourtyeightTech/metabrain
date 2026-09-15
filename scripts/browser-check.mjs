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
    env: { ...process.env, METATRAY_MODE: mode, METATRAY_FEED: 'rpc', RPC_HTTP_URL: '', CHAIN_ID: '', TOKEN_ADDRESS: '', PONS_FACTORY_ADDRESS: '', MARKET_PROTOCOL: 'pons-v2', DATABASE_URL: '', DATABASE_READ_URL: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe']
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
  assert.equal(await page.title(), 'metatray');
  assert.ok(await page.locator('header img[src*="tray-wordmark"]').count());
  assert.ok(await page.locator('link[rel="icon"][href*="favicon.svg"]').count());
  assert.equal(await page.getByRole('link', { name: 'Open view', exact: true }).getAttribute('href'), '/experiment');
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
  const keyboardTrade = page.locator('tbody tr').first().getByRole('button', { name: /^Inspect / });
  await keyboardTrade.focus();
  await page.keyboard.press('Space');
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
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
  await page.getByRole('button', { name: 'Data receipt' }).click();
  const download = await downloadPromise; const stream = await download.createReadStream();
  let receipt = ''; for await (const part of stream) receipt += part;
  const parsed = JSON.parse(receipt); assert.equal(parsed.snapshot.mode, 'demo'); assert.equal(parsed.prediction, null);
  const visualPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Visual receipt' }).click();
  const visual = await visualPromise; assert.match(visual.suggestedFilename(), /^metatray-market-receipt\.png$/);
  await page.getByRole('heading', { name: 'The Cortical Chronicle.' }).waitFor();
  await page.getByText('The chronicle begins with the first validated epoch.').waitFor();
  await nav.getByRole('link', { name: 'The science', exact: true }).click();
  await page.getByRole('heading', { name: 'Timing and uncertainty' }).waitFor();
  await page.getByRole('link', { name: 'Model setup', exact: true }).click();
  await page.getByRole('heading', { name: 'Connect the market. Then the model.' }).waitFor();
  await nav.getByRole('link', { name: 'Observatory', exact: true }).click();
  await page.getByRole('button', { name: 'Reset replay' }).click();
  await page.getByRole('button', { name: 'Reset brain view' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  if (await dismiss.count()) await dismiss.click();
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
    const layout = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('body *')].map(element => { const rect = element.getBoundingClientRect(); return {
        tag: element.tagName, className: typeof element.className === 'string' ? element.className : '', left: rect.left, right: rect.right, width: rect.width
      }; }).filter(rect => rect.left < -1 || rect.right > window.innerWidth + 1).slice(0, 8) }));
    assert.equal(layout.page > layout.viewport, false, `Page overflows at ${width}px: ${JSON.stringify(layout.offenders)}`);
  }
  for (const route of ['experiment', 'about', 'science', 'how-it-works', 'lore', 'deployment', 'terms', 'privacy', 'evidence']) {
    await page.goto(`http://127.0.0.1:3100/${route}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal(await page.title(), 'metatray');
    assert.ok(await page.locator('.article-body section').count() > 0);
    await page.getByRole('navigation', { name: 'On this page' }).waitFor();
  }
  assert.ok(await page.locator('a[href*="ponsdotdev/ponsfamily/blob/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f"]').count() >= 4);
  const health = await (await fetch('http://127.0.0.1:3100/api/health')).json(); assert.equal(health.status, 'demo');
  assert.equal((await fetch('http://127.0.0.1:3100/api/predictions/not-an-id')).status, 400);
  assert.equal((await fetch('http://127.0.0.1:3100/api/mesh')).status, 404);
  await server(3101, 'live');
  const unavailable = await fetch('http://127.0.0.1:3101/api/snapshot');
  assert.equal(unavailable.status, 503);
  const setup = await unavailable.json(); assert.equal(setup.mode, 'live'); assert.deepEqual(setup.ticks, []);
  assert.equal(setup.feed.phase, 'setup'); assert.ok(setup.feed.missing.includes('RPC_HTTP_URL'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3101', { waitUntil: 'networkidle' });
  await page.getByText('Connect your real token', { exact: true }).waitFor();
  await page.locator('.env-chips').getByText('RPC_HTTP_URL', { exact: true }).waitFor();
  await page.locator('.cortex-canvas canvas').waitFor();
  assert.equal(await page.locator('[data-visual-mode="schematic"]').count(), 1);
  for (const repo of ['https://github.com/fourtyeightTech/metabrain', 'https://github.com/facebookresearch/tribev2']) {
    assert.ok(await page.locator(`a[href="${repo}"]`).count() >= 2);
  }
  await page.screenshot({ path: new URL('live-setup.png', out).pathname, fullPage: true });

  // Browser contract fixtures only. Not real chain observations or Meta predictions.
  let eventNumber = 1; let fail = false; let model = false;
  const predictionId = '11111111-1111-1111-1111-111111111111';
  const summary = () => ({ id: predictionId, source: 'tribe-v2', inputStart: Date.now() - 100000,
    inputEnd: Date.now() - 10000, availableAt: Date.now() - 1000, modelRevision: 'fixture-only', stimulusHash: 'fixture-input',
    outputHash: 'fixture-output', meanAbsoluteResponse: 0.2, responseChange: 0.1, sampleCount: 2, vertexCount: 4, latencyMs: 1000,
    alignment: 'upstream-segment-timestamps', runMode: 'rolling-window-experimental' });
  await page.route('**/api/snapshot?*', route => {
    const now = Date.now(); const txHash = '0x' + eventNumber.toString(16).padStart(64, '0');
    const tick = { id: `1:${txHash}:0`, ts: now, price: 1.2, quoteAmount: 12, tokenAmount: 10,
      side: eventNumber % 2 ? 'buy' : 'sell', venue: 'uniswap-v3', blockNumber: 100, blockHash: '0x' + '11'.repeat(32), txHash,
      logIndex: 0, raw: { tokenAmount: '10000000000000000000', quoteAmount: '12000000000000000000' } };
    return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Fixture provider unavailable' } : { ...setup,
      connected: true, stale: false, now, heartbeat: now, chainId: 1, token: '0x' + '1'.repeat(40), symbol: 'FIXTURE', quoteSymbol: 'QUOTE',
      indexedBlock: 100, ticks: [tick], message: 'Controlled browser fixture; not a real chain observation.',
      prediction: model ? summary() : null, inferenceEnabled: model,
      epochs: model ? [{ ...summary(), tradeCount: 1, observedVolume: 12, priceChangePct: 4.2, regime: 'rally' }] : [],
      feed: { ...setup.feed, source: model ? 'indexed' : 'rpc', phase: 'live', checkedAt: now, chainHead: 102, fromBlock: 96, toBlock: 100,
        pollMs: 1000, missing: [], invalid: [], explorer: 'https://explorer.invalid' } } });
  });
  await page.route('**/api/predictions/' + predictionId, route => route.fulfill({ json: { ...summary(),
    values: [0.2, -0.2, 0.1, -0.1], times: [0, 1], responseTrace: [0.1, 0.2], segmentOffsets: [0], colorLimit: 1, manifest: { fixture: true } } }));
  await page.route('**/api/mesh', route => route.fulfill({ json: {
    vertices: [-25, -25, 0, 25, -25, 0, 0, 25, 0, 0, 0, 25], faces: [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3],
    hemisphereBoundary: 2, mesh: 'fsaverage5' } }));
  await page.getByRole('button', { name: 'Refresh live feed', exact: true }).click();
  await page.locator('[data-visual-mode="market-input"]').waitFor();
  await page.getByText('LIVE ON-CHAIN', { exact: true }).waitFor();
  await page.getByText('TX SIGNAL // BUY', { exact: true }).waitFor();
  await page.getByText('BLOCK 100', { exact: true }).waitFor();
  await page.locator('.incoming-row').waitFor();
  const canvas = await page.locator('.cortex-canvas canvas').elementHandle();
  const firstInput = await page.locator('.cortex-stage').getAttribute('data-input-event');
  eventNumber = 2;
  await page.waitForFunction(previous => document.querySelector('.cortex-stage')?.getAttribute('data-input-event') !== previous, firstInput);
  assert.equal(await canvas.evaluate(el => el.isConnected), true, 'Market updates must not recreate the WebGL canvas');
  await page.locator('.incoming-row button').click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('link', { name: 'Verify transaction on explorer' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Close event details' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: new URL('live-fixture.png', out).pathname, fullPage: true });
  await page.getByRole('button', { name: 'Pause view', exact: true }).click();
  await page.locator('.feed-console').getByText('VIEW PAUSED', { exact: true }).waitFor();
  assert.equal(await page.locator('.cortex-stage').getAttribute('data-input-event'), null);
  await page.getByRole('button', { name: 'Resume view', exact: true }).click();
  fail = true;
  await page.getByText('NOT CONNECTED', { exact: true }).waitFor();
  await page.locator('[data-visual-mode="schematic"]').waitFor();
  fail = false; model = true;
  await page.locator('[data-visual-mode="model-output"]').waitFor();
  await page.getByText('MODEL OUTPUT', { exact: true }).waitFor();
  await page.getByText('1 VALIDATED EPOCHS', { exact: true }).waitFor();
  await page.getByRole('button', { name: /EPOCH 001/ }).click();
  const corticalReceipt = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Visual receipt' }).click();
  assert.match((await corticalReceipt).suggestedFilename(), /^metatray-cortical-receipt\.png$/);
  await page.getByRole('button', { name: 'Pause view', exact: true }).click();
  await page.getByText('DELAYED OUTPUT', { exact: true }).waitFor();
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Live page overflows at ${width}px`);
  }
  await page.locator('.cortex-canvas canvas').evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await page.getByText('WebGL is unavailable. The live feed and receipts below still work.').waitFor();
  assert.deepEqual(errors, []);
  const report = { status: 'passed', viewport: ['1440x1100', '390x844', '320x1000', '768x1000', '1024x1000'],
    checks: ['production render', '3D schematic', 'hero viewer tabs and arrow keys', 'camera rotation and reduced motion', 'FAQ expansion', 'paper policy controls', 'pause/reset', 'native transaction-row keyboard activation', 'event modal and Escape',
      'chart range', 'data and visual receipt downloads', 'cortical epoch atlas', 'Experiment 001 Open view route', 'informational routes, titles and navigation', 'mobile overflow', 'API mode boundaries', 'live setup instructions', 'real repository links', 'fixture event updates without canvas remount', 'pause and outage status', 'fixture model surface', 'WebGL fallback', 'event link keyboard access'],
    realChainTested: false, realTribeTested: false };
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close(); for (const child of processes) child.kill('SIGTERM');
}
