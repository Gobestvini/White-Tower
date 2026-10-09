const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async () => {
 const options={headless:true};if(process.env.CHROMIUM_EXECUTABLE_PATH)options.executablePath=process.env.CHROMIUM_EXECUTABLE_PATH;const browser=await chromium.launch(options);
 try{const page=await browser.newPage({viewport:{width:720,height:1280}});const errors=[];page.on('pageerror',error=>errors.push(error.message));const url=new URL(baseUrl);url.searchParams.set('renderer','2d');await page.goto(url.toString());await page.waitForFunction(()=>window.gameDebug?.snapshot().loaded,{timeout:15000});
  const solveCurrent=async()=>page.evaluate(()=>{for(const move of window.gameDebug.snapshot().level.knownSolution){const animation=window.gameDebug.launch(move);window.gameDebug.finishAnimation(animation.generationId);}return window.gameDebug.snapshot().phase;});
  for(let n=1;n<=10;n++){await page.evaluate(id=>window.gameDebug.setLevelById(id),`level-${String(n).padStart(3,'0')}`);assert.equal(await solveCurrent(),'Won');}
  await page.evaluate(()=>window.gameDebug.setLevelById('level-011'));assert.equal(await solveCurrent(),'Won');await page.getByRole('button',{name:'NEXT'}).click();await page.waitForFunction(()=>window.gameDebug.snapshot().levelId==='level-012');await page.waitForFunction(()=>document.querySelector('.hud-level')?.textContent==='Lv.12');
  await page.screenshot({path:'docs/reviews/vertical-slice-level12-2d.png'});assert.equal(await solveCurrent(),'Won');
  for(let n=13;n<=119;n++){await page.evaluate(id=>window.gameDebug.setLevelById(id),`level-${String(n).padStart(3,'0')}`);assert.equal(await solveCurrent(),'Won',`level ${n}`);}
  await page.evaluate(()=>window.gameDebug.setLevelById('level-120'));assert.equal(await solveCurrent(),'Won');await page.getByRole('button',{name:'CHOOSE LEVEL'}).waitFor({timeout:2000});assert.equal(await page.locator('.next-button:not(.victory-choose):not([hidden])').count(),0);assert.equal((await page.evaluate(()=>window.gameDebug.snapshot())).levelCount,120);assert.deepEqual(errors,[]);
  process.stdout.write('Campaign browser integration: solutions 1–120, 11→12 Next, and level-120 completion screen passed.\n');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
