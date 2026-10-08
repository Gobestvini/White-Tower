// Optional tool: set PLAYWRIGHT_MODULE or install Playwright separately.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async () => {
  const options = { headless: true };
  if (process.env.BROWSER_CHANNEL) options.channel = process.env.BROWSER_CHANNEL;
  if (process.env.CHROMIUM_EXECUTABLE_PATH) options.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(options);
  try {
    fs.mkdirSync('artifacts/screenshots', { recursive: true });
    for (const [name, viewport, touch] of [
      ['desktop', { width: 1280, height: 900 }, false],
      ['mobile', { width: 390, height: 844 }, true],
    ]) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) errors.push(`HTTP ${response.status()}`); });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().loaded && window.gameDebug.snapshot().elapsed > 0);
      await page.getByRole('button', { name: 'Пауза', exact: true }).click();
      const before = await page.evaluate(() => window.gameDebug.snapshot().elapsed);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), before);
      await page.keyboard.down('KeyW');
      assert.ok((await page.evaluate(() => window.gameDebug.snapshot().keys)).includes('KeyW'));
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.deepEqual(await page.evaluate(() => window.gameDebug.snapshot().keys), []);
      await page.keyboard.up('KeyW');
      await page.getByRole('button', { name: 'Сброс', exact: true }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), 0);
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.waitForFunction(() => window.gameDebug.snapshot().elapsed > 0);
      await page.evaluate(async () => {
        const ids = Array.from({ length: 11 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`);
        for (const id of ids) await window.gameDebug.setLevelById(id);
        await window.gameDebug.setLevelById('level-006');
        window.gameDebug.setTowerDemo(14);
        await new Promise(requestAnimationFrame);
      });
      const warmCounts = await page.evaluate(() => window.gameDebug.resourceCounts());
      await page.evaluate(async () => {
        const ids = Array.from({ length: 11 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`);
        for (let index = 0; index < 20; index++) await window.gameDebug.setLevelById(ids[index % ids.length]);
        await window.gameDebug.setLevelById('level-006');
        window.gameDebug.setTowerDemo(14);
        await new Promise(requestAnimationFrame);
      });
      const repeatedCounts = await page.evaluate(() => window.gameDebug.resourceCounts());
      assert.equal(repeatedCounts.geometries, warmCounts.geometries, 'geometry count should stabilize across level changes');
      assert.equal(repeatedCounts.textures, warmCounts.textures, 'the procedural renderer should not allocate textures');
      assert.equal(repeatedCounts.programs, warmCounts.programs, 'material program count should stabilize');
      assert.equal(repeatedCounts.children, warmCounts.children, 'scene object count should return to baseline after reset');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/screenshots/${name}.png` });
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas.style.width = '720px';
        canvas.style.height = '1280px';
        document.querySelector('main').style.width = '720px';
        document.querySelector('main').style.margin = '0';
      });
      for (const [id, file] of [['level-001', 'r01'], ['level-006', 'r06'], ['level-007', 'r08']]) {
        await page.evaluate(async value => { await window.gameDebug.setLevelById(value); await new Promise(requestAnimationFrame); }, id);
        await page.locator('canvas').screenshot({ path: `artifacts/screenshots/${file}-${name}.png` });
      }
      await page.evaluate(async () => { await window.gameDebug.setLevelById('level-006'); window.gameDebug.setTowerDemo(14); await new Promise(requestAnimationFrame); });
      await page.locator('canvas').screenshot({ path: `artifacts/screenshots/r07-${name}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Desktop/mobile layout, pause/reset, input and runtime errors: passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
