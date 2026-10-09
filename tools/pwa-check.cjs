const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
 const options={headless:true};if(process.env.CHROMIUM_EXECUTABLE_PATH)options.executablePath=process.env.CHROMIUM_EXECUTABLE_PATH;
 const browser=await chromium.launch(options);const context=await browser.newContext();const page=await context.newPage();
 try {
  await page.goto(baseUrl);await page.waitForFunction(()=>navigator.serviceWorker?.controller,{timeout:45000});
  await page.waitForFunction(()=>!!document.querySelector('.hud-level')?.textContent,{timeout:15000});
  await page.reload();
  await page.waitForFunction(()=>!!document.querySelector('.hud-level')?.textContent,{timeout:15000});
  const assets=await page.evaluate(async()=>{const r=await fetch('/content/catalog.json');const catalog=await r.json();return{count:catalog.levels.length,worker:navigator.serviceWorker.controller?.scriptURL};});
  assert.equal(assets.count,120);assert.ok(assets.worker.endsWith('/sw.js'));
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!document.querySelector('.hud-level')?.textContent,{timeout:15000});
  const after=await page.evaluate(async()=>({content:await (await fetch('/content/levels/120.json')).json(),level:document.querySelector('.hud-level')?.textContent}));
  assert.equal(after.content.id,'level-120');assert.ok(after.level);
  process.stdout.write('Production PWA: worker installed, 120 levels cached, offline reload served the game shell and level 120.\n');
 } finally {await context.setOffline(false).catch(()=>{});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
