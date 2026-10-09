// Optional tool: set PLAYWRIGHT_MODULE or install Playwright separately.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
const exampleLevels = JSON.parse(fs.readFileSync('docs/knowledge/white-tower/levels_examples.json', 'utf8')).levels;
(async () => {
  const options = { headless: true };
  if (process.env.BROWSER_CHANNEL) options.channel = process.env.BROWSER_CHANNEL;
  if (process.env.CHROMIUM_EXECUTABLE_PATH) options.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(options);
  try {
    fs.mkdirSync('artifacts/screenshots', { recursive: true });
    const editorPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const editorUrl = new URL('/tools/level-editor/', baseUrl);
    await editorPage.goto(editorUrl.toString());
    await editorPage.locator('#json').waitFor();
    assert.equal(await editorPage.locator('script[type="module"][src^="./main.ts"]').count(), 1, 'the development editor stays a separate page entry');
    await editorPage.locator('[data-tool="redirect"]').click();
    await editorPage.locator('#direction').selectOption('SW');
    await editorPage.locator('#coord-u').fill('2');
    await editorPage.locator('#coord-v').fill('0');
    await editorPage.getByRole('button', { name: 'Apply tool at coordinate' }).click();
    const modifiedLevel = JSON.parse(await editorPage.locator('#json').inputValue());
    assert.deepEqual(modifiedLevel.cells[2], { u: 2, v: 0, kind: 'redirect', direction: 'SW' });
    await editorPage.getByRole('button', { name: 'Test / solve' }).click();
    await editorPage.waitForFunction(() => document.querySelector('#status')?.textContent.startsWith('Playable.'));
    const downloadPromise = editorPage.waitForEvent('download');
    await editorPage.getByRole('button', { name: 'Download JSON' }).click();
    const exported = await downloadPromise;
    assert.equal(exported.suggestedFilename(), 'editor-draft.json');
    const boardImagePromise = editorPage.waitForEvent('download');
    await editorPage.getByRole('button', { name: 'Save board image' }).click();
    const boardImage = await boardImagePromise;
    assert.equal(boardImage.suggestedFilename(), 'editor-draft.png');
    await boardImage.saveAs('docs/reviews/editor-roundtrip.png');
    await editorPage.getByRole('button', { name: 'Undo editor' }).click();
    assert.equal(JSON.parse(await editorPage.locator('#json').inputValue()).cells[2].kind, 'normal', 'editor Undo is separate from game Undo');
    await editorPage.locator('#json').fill(JSON.stringify(modifiedLevel, null, 2));
    await editorPage.getByRole('button', { name: 'Import and validate' }).click();
    assert.match(await editorPage.locator('#status').textContent(), /Imported level validated/);
    await editorPage.locator('#json').fill('{');
    await editorPage.getByRole('button', { name: 'Import and validate' }).click();
    assert.match(await editorPage.locator('#status').textContent(), /JSON parse error/);
    await editorPage.getByRole('button', { name: 'Refresh JSON' }).click();
    assert.equal(JSON.parse(await editorPage.locator('#json').inputValue()).id, 'editor-draft', 'invalid import preserves the current project');
    await editorPage.getByRole('button', { name: 'Undo editor' }).click();
    assert.equal(JSON.parse(await editorPage.locator('#json').inputValue()).cells[2].kind, 'normal', 'editor Undo restores the separate previous draft');
    await editorPage.close();
    for (const [name, viewport, touch] of [
      ['desktop', { width: 1280, height: 900 }, false],
      ['mobile', { width: 390, height: 844 }, true],
    ]) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) errors.push(`HTTP ${response.status()}`); });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().loaded && window.gameDebug.snapshot().elapsed > 0);
      assert.equal(await page.locator('.hud-counter').textContent(), '0/4');
      assert.equal(await page.locator('.hud-level').textContent(), 'Lv.1');
      assert.equal(await page.getByRole('button', { name: 'Undo last move' }).isDisabled(), true);
      for (const label of ['Settings', 'Restart level', 'Undo last move']) {
        const box = await page.getByRole('button', { name: label }).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${label} hit area is at least 44 CSS px`);
      }
      await page.getByRole('button', { name: 'Settings' }).click();
      const settingsDialog = page.locator('.settings-panel');
      await settingsDialog.waitFor({ state: 'visible' });
      const menuBounds = await settingsDialog.locator('.settings-card').boundingBox();
      const gameBounds = await page.locator('main').boundingBox();
      assert.ok(menuBounds.x >= gameBounds.x && menuBounds.y >= gameBounds.y && menuBounds.x + menuBounds.width <= gameBounds.x + gameBounds.width && menuBounds.y + menuBounds.height <= gameBounds.y + gameBounds.height, `${name} settings fit inside the game viewport`);
      const boardOccluded = await page.evaluate(() => {
        const point = window.gameDebug.pointForStack(window.gameDebug.selectedStackId());
        const rect = document.querySelector('canvas').getBoundingClientRect();
        const scale = Math.min(rect.width / 720, rect.height / 1280);
        const x = rect.left + (rect.width - 720 * scale) / 2 + point.x * scale;
        const y = rect.top + (rect.height - 1280 * scale) / 2 + point.y * scale;
        return document.elementFromPoint(x, y)?.closest('canvas') === null;
      });
      assert.equal(boardOccluded, true, 'the modal layer intercepts the board hit area');
      await page.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 0, 'the menu phase cannot start a move');
      await page.getByRole('button', { name: 'Clear progress' }).click();
      await page.getByRole('button', { name: 'CANCEL' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).levelId, 'level-001', 'canceling clear leaves the current progress intact');
      await settingsDialog.getByLabel('Language').selectOption('ru');
      await settingsDialog.getByRole('heading', { name: 'Настройки' }).waitFor();
      await settingsDialog.locator('select').first().focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'ВЕРНУТЬСЯ В ИГРУ', 'focus wraps to the final dialog action');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Настройки' }).waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Настройки');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Настройки', 'closing the dialog returns focus to its opener');
      await page.getByRole('button', { name: 'Настройки' }).click();
      const russianDialog = page.locator('.settings-panel');
      await russianDialog.locator('select').first().selectOption('en');
      await russianDialog.getByRole('button', { name: /Choose level/ }).click();
      const levelGridBounds = await russianDialog.locator('.level-grid').boundingBox();
      assert.ok(levelGridBounds.height > 0 && levelGridBounds.width > 0, `${name} level grid remains visible`);
      assert.equal(await russianDialog.getByRole('button', { name: 'Level 1', exact: true }).isDisabled(), false);
      assert.equal(await russianDialog.getByRole('button', { name: 'Level 2, Locked', exact: true }).isDisabled(), true, 'unopened future levels are locked');
      await russianDialog.getByRole('button', { name: 'BACK TO SETTINGS' }).click();
      await russianDialog.getByRole('button', { name: 'BACK TO GAME' }).click();
      if (touch) {
        await page.evaluate(() => window.gameDebug.setLevelById('level-001'));
        const mobileTap = await page.evaluate(() => {
          const point = window.gameDebug.pointForStack(window.gameDebug.selectedStackId());
          const rect = document.querySelector('canvas').getBoundingClientRect();
          const scale = Math.min(rect.width / 720, rect.height / 1280);
          return { x: rect.left + (rect.width - 720 * scale) / 2 + point.x * scale, y: rect.top + (rect.height - 1280 * scale) / 2 + point.y * scale };
        });
        await page.touchscreen.tap(mobileTap.x, mobileTap.y);
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 1, 'touch on the active top face launches once at DPR 2');
        await page.evaluate(() => window.gameDebug.setLevelById('level-001'));
      }
      await page.evaluate(() => window.gameDebug.setPaused(true));
      const before = await page.evaluate(() => window.gameDebug.snapshot().elapsed);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), before);
      await page.keyboard.down('KeyW');
      assert.ok((await page.evaluate(() => window.gameDebug.snapshot().keys)).includes('KeyW'));
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.deepEqual(await page.evaluate(() => window.gameDebug.snapshot().keys), []);
      await page.keyboard.up('KeyW');
      await page.getByRole('button', { name: 'Restart level' }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), 0);
      await page.evaluate(() => window.gameDebug.setPaused(false));
      await page.waitForFunction(() => window.gameDebug.snapshot().elapsed > 0);
      await page.evaluate(async () => {
        const ids = Array.from({ length: 12 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`);
        for (const id of ids) await window.gameDebug.setLevelById(id);
        await window.gameDebug.setLevelById('level-006');
        window.gameDebug.setTowerDemo(14);
        await new Promise(requestAnimationFrame);
      });
      const warmCounts = await page.evaluate(() => window.gameDebug.resourceCounts());
      await page.evaluate(async () => {
        const ids = Array.from({ length: 12 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`);
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
      if (!touch) await page.setViewportSize({ width: 720, height: 1280 });
      await page.evaluate(() => {
        document.querySelector('main').style.width = '720px';
        document.querySelector('main').style.height = '1280px';
        document.querySelector('main').style.margin = '0';
        window.dispatchEvent(new Event('resize'));
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      for (const [id, file] of [['level-001', 'r01'], ['level-006', 'r06'], ['level-007', 'r08']]) {
        await page.evaluate(async value => { await window.gameDebug.setLevelById(value); await new Promise(requestAnimationFrame); }, id);
        await page.locator('canvas').screenshot({ path: `artifacts/screenshots/${file}-${name}.png` });
      }
      if (!touch) {
        await page.evaluate(() => window.gameDebug.setLevelById('level-001'));
        await page.screenshot({ path: 'artifacts/screenshots/r01-hud.png' });
      }
      await page.evaluate(async () => { await window.gameDebug.setLevelById('level-006'); window.gameDebug.setTowerDemo(14); await new Promise(requestAnimationFrame); });
      await page.locator('canvas').screenshot({ path: `artifacts/screenshots/r07-${name}.png` });
      await page.setViewportSize({ width: 720, height: 1280 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      const fallbackState = await page.evaluate(async () => {
        await window.gameDebug.setLevelById('level-002');
        let complete;
        for (const start of [{ u: 2, v: 0 }, { u: 0, v: 2 }]) {
          const launched = window.gameDebug.launch(start);
          complete = window.gameDebug.finishAnimation(launched.generationId);
        }
        const before = { moveCount: complete.committedState.moveCount, canUndo: complete.canUndo, attemptId: complete.attemptId };
        if (!window.gameDebug.setRendererMode('2d')) throw new Error('Could not switch to Canvas 2D.');
        await new Promise(requestAnimationFrame);
        const mode = window.gameDebug.rendererInfo().mode;
        const afterSwitch = window.gameDebug.snapshot();
        return { before, mode, afterSwitch: { moveCount: afterSwitch.committedState.moveCount, canUndo: afterSwitch.canUndo, attemptId: afterSwitch.attemptId } };
      });
      await page.locator('canvas').screenshot({ path: `artifacts/screenshots/r02-2d-${name}.png` });
      const fallbackUndo = await page.evaluate(() => {
        const undone = window.gameDebug.undo();
        const state = { moveCount: undone.committedState.moveCount, canUndo: undone.canUndo, attemptId: undone.attemptId, phase: undone.phase };
        if (!window.gameDebug.setRendererMode('webgl')) throw new Error('Could not switch back to WebGL.');
        return state;
      });
      assert.equal(fallbackState.before.moveCount, 2);
      assert.equal(fallbackState.before.canUndo, true);
      assert.equal(fallbackState.mode, '2d');
      assert.deepEqual(fallbackState.afterSwitch, fallbackState.before);
      assert.deepEqual(fallbackUndo, { moveCount: 1, canUndo: true, attemptId: fallbackState.before.attemptId, phase: 'Idle' });
      if (name === 'desktop') {
        const routes = [
          exampleLevels.find(level => level.id === 'D_ring'),
          await page.evaluate(async () => (await (await fetch('/content/levels/006.json')).json()), null),
        ];
        for (const route of routes) {
          await page.evaluate(level => window.gameDebug.loadLevel(level), route);
          const launch = await page.evaluate(level => window.gameDebug.launch(level.knownSolution[0]), route);
          assert.equal(launch.phase, 'Animating', `${route.id} starts its move animation`);
          await page.waitForTimeout(100);
          const presentation = await page.evaluate(() => window.gameDebug.presentationSnapshot());
          assert.equal(presentation.active, true, `${route.id} remains in presentation during movement`);
          assert.ok(presentation.stacks.some(stack => stack.tilt !== undefined || stack.height % 1 !== 0), `${route.id} exposes a moving pose`);
          await page.locator('canvas').screenshot({ path: `artifacts/screenshots/animation-${route.id}.png` });
          await page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'Animating', null, { timeout: 6000 });
        }
        await page.evaluate(() => window.gameDebug.setRendererMode('2d'));
        await page.evaluate(level => window.gameDebug.loadLevel(level), exampleLevels.find(level => level.id === 'A_line'));
        await page.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
        await page.waitForTimeout(100);
        assert.equal((await page.evaluate(() => window.gameDebug.presentationSnapshot())).active, true, 'Canvas 2D presents a move in progress');
        await page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'Animating', null, { timeout: 6000 });
        await page.evaluate(() => window.gameDebug.setRendererMode('webgl'));
        await page.evaluate(level => window.gameDebug.loadLevel(level), exampleLevels.find(level => level.id === 'A_line'));
        await page.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
        await page.evaluate(() => window.gameDebug.setPaused(true));
        const pausedAnimation = await page.evaluate(() => window.gameDebug.presentationSnapshot().elapsedMs);
        await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => window.gameDebug.presentationSnapshot().elapsedMs), pausedAnimation, 'pause freezes an active move');
        await page.evaluate(() => window.gameDebug.setPaused(false));
        await page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'Animating', null, { timeout: 6000 });
      }
      const replay = await page.evaluate(async levels => {
        const outcomes = [];
        for (const mode of ['webgl', '2d']) {
          if (!window.gameDebug.setRendererMode(mode)) throw new Error(`Could not select ${mode}.`);
          for (const level of levels) {
            window.gameDebug.loadLevel(level);
            let completed;
            for (const start of level.knownSolution) {
              const started = window.gameDebug.launch(start);
              if (started.phase !== 'Animating') throw new Error(`${level.id} rejected the known move.`);
              completed = window.gameDebug.finishAnimation(started.generationId);
            }
            if (completed.phase !== 'Won') throw new Error(`${level.id} did not reach victory in ${mode}.`);
            outcomes.push({ levelId: level.id, mode, moves: completed.committedState.moveCount });
          }
        }
        window.gameDebug.setRendererMode('webgl');
        return outcomes;
      }, exampleLevels.filter(level => ['A_line', 'D_ring'].includes(level.id)));
      assert.deepEqual(replay.map(item => [item.levelId, item.mode]), [['A_line', 'webgl'], ['D_ring', 'webgl'], ['A_line', '2d'], ['D_ring', '2d']]);
      for (const level of exampleLevels.filter(item => ['A_line', 'C_diamond', 'D_ring'].includes(item.id))) {
        await page.evaluate(item => window.gameDebug.loadLevel(item), level);
        await page.locator('canvas').focus();
        for (const move of level.knownSolution) {
          const target = `stack:${move.u},${move.v}`;
          let found = await page.evaluate(() => window.gameDebug.selectedStackId());
          for (let attempt = 0; found !== target && attempt < 16; attempt++) {
            await page.keyboard.press('ArrowRight');
            found = await page.evaluate(() => window.gameDebug.selectedStackId());
          }
          assert.equal(found, target, `${level.id} keyboard navigation can select the next solution arrow`);
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => ['Idle', 'Won'].includes(window.gameDebug.snapshot().phase), null, { timeout: 6000 }).catch(async error => {
            const stuck = await page.evaluate(() => ({ phase: window.gameDebug.snapshot().phase, animation: window.gameDebug.presentationSnapshot(), paused: window.gameDebug.snapshot().paused }));
            throw new Error(`${level.id} keyboard move ${JSON.stringify(move)} did not settle: ${JSON.stringify(stuck)}; ${error.message}`);
          });
        }
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).phase, 'Won', `${level.id} is solvable with arrow keys and Enter`);
        await page.keyboard.press('Control+z');
        await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'Idle');
        await page.keyboard.press('Escape');
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).phase, 'Menu', 'keyboard can open Settings from an active level');
        await page.keyboard.press('Escape');
      }
      await page.evaluate(() => window.gameDebug.setLevelById('level-001'));
      await page.locator('canvas').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      let keyboardState = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(keyboardState.phase, 'Animating', 'keyboard starts the presentation phase');
      assert.equal(await page.getByRole('button', { name: 'Undo last move' }).isDisabled(), true, 'Undo is unavailable while a route is moving');
      for (const count of ['2/4', '3/4', '4/4']) await page.waitForFunction(value => document.querySelector('.hud-counter').textContent === value, count, { timeout: 5000 });
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won', null, { timeout: 5000 });
      keyboardState = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(keyboardState.phase, 'Won', 'keyboard completes level A after the stop animation');
      assert.equal(keyboardState.committedState.moveCount, 1);
      assert.equal(await page.locator('.victory-layer').evaluate(element => element.classList.contains('is-visible')), false, 'victory waits for its 250–350 ms reveal delay');
      await page.locator('.victory-layer.is-visible').waitFor({ timeout: 1500 });
      await page.waitForTimeout(220);
      if (!touch) await page.screenshot({ path: 'artifacts/screenshots/r12-hud.png' });
      assert.equal(await page.getByText('LEVEL', { exact: true }).count(), 1);
      assert.equal(await page.getByText('COMPLETED!', { exact: true }).count(), 1);
      const victoryUndo = page.getByRole('button', { name: 'Undo last move' }).last();
      await victoryUndo.evaluate(button => button.click());
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).phase, 'Idle', 'Undo after victory restores an interactive field');
      await page.waitForFunction(() => !document.querySelector('.victory-layer').classList.contains('is-visible'));
      assert.equal(await page.locator('.victory-layer').evaluate(element => element.classList.contains('is-visible')), false);
      await page.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won', null, { timeout: 5000 });
      await page.locator('.victory-layer.is-visible').waitFor({ timeout: 1500 });
      await page.evaluate(() => {
        const next = document.querySelector('.next-button');
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-002', null, { timeout: 5000 });
      await page.waitForFunction(() => document.querySelector('.hud-level').textContent === 'Lv.2' && !document.querySelector('main').classList.contains('is-won'));
      const nextState = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(nextState.committedState.moveCount, 0, 'double NEXT advances exactly one level');
      assert.equal(nextState.phase, 'Idle', 'NEXT starts the new level in a stable phase');
      const startedSecondLevel = await page.evaluate(() => {
        const started = window.gameDebug.launch({ u: 2, v: 0 });
        return window.gameDebug.finishAnimation(started.generationId);
      });
      assert.equal(startedSecondLevel.committedState.moveCount, 1, 'the next level accepts a move before Restart');
      await page.getByRole('button', { name: 'Restart level' }).evaluate(button => button.click());
      const restartedSecondLevel = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(restartedSecondLevel.phase, 'Idle', 'Restart returns to a playable phase');
      assert.equal(restartedSecondLevel.committedState.moveCount, 0, 'Restart clears the current level attempt');
      assert.equal(restartedSecondLevel.canUndo, false, 'Restart clears the attempt undo history');
      await page.keyboard.press('Control+z');
      keyboardState = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(keyboardState.phase, 'Idle');
      assert.equal(keyboardState.committedState.moveCount, 0);
      await page.locator('canvas').focus();
      await page.keyboard.press('Escape');
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).phase, 'Menu');
      await page.keyboard.press('Escape');
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).phase, 'Idle');
      await page.keyboard.press('r');
      const beforeOutsideShortcut = await page.evaluate(() => window.gameDebug.snapshot().attemptId);
      await page.getByRole('button', { name: 'Settings' }).focus();
      await page.keyboard.press('r');
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().attemptId), beforeOutsideShortcut, 'R outside the game must not restart');

      await page.evaluate(() => window.gameDebug.setLevelById('level-002'));
      await page.locator('canvas').focus();
      const selectedBefore = await page.evaluate(() => window.gameDebug.selectedStackId());
      await page.keyboard.press('ArrowRight');
      const selectedAfter = await page.evaluate(() => window.gameDebug.selectedStackId());
      assert.notEqual(selectedAfter, selectedBefore, 'arrow key cycles the active stacks');

      await page.evaluate(() => window.gameDebug.setLevelById('level-001'));
      const tapPoint = await page.evaluate(() => {
        const point = window.gameDebug.pointForStack(window.gameDebug.selectedStackId());
        const rect = document.querySelector('canvas').getBoundingClientRect();
        const scale = Math.min(rect.width / 720, rect.height / 1280);
        return { x: rect.left + (rect.width - 720 * scale) / 2 + point.x * scale, y: rect.top + (rect.height - 1280 * scale) / 2 + point.y * scale };
      });
      const hitDebug = await page.evaluate(({ x, y }) => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        const scale = Math.min(rect.width / 720, rect.height / 1280);
        const point = { x: (x - rect.left - (rect.width - 720 * scale) / 2) / scale, y: (y - rect.top - (rect.height - 1280 * scale) / 2) / scale };
        return { point, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight }, selected: window.gameDebug.selectedStackId(), hit: window.gameDebug.pickStack(point) };
      }, tapPoint);
      await page.evaluate(() => {
        window.__pointerTrace = [];
        for (const type of ['pointerdown', 'pointerup', 'pointercancel']) window.addEventListener(type, event => window.__pointerTrace.push({ type, target: event.target?.tagName, x: event.clientX, y: event.clientY, pointerType: event.pointerType, primary: event.isPrimary, button: event.button }), true);
      });
      if (!touch) {
        await page.mouse.move(tapPoint.x, tapPoint.y); await page.mouse.down(); await page.mouse.move(tapPoint.x + 20, tapPoint.y); await page.mouse.up();
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 0, 'drag beyond 12 CSS pixels must not move');
        await page.mouse.click(tapPoint.x, tapPoint.y);
      }
      if (!touch) {
        const pointerTrace = await page.evaluate(() => window.__pointerTrace);
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 1, `tap on the active top face launches once (${JSON.stringify({ hitDebug, pointerTrace })})`);
        await page.mouse.click(tapPoint.x, tapPoint.y);
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 1, 'a second tap on the vacated target cannot duplicate a move');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    const guidancePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    guidancePage.setDefaultTimeout(7000);
    await guidancePage.goto(baseUrl);
    await guidancePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    await guidancePage.locator('.tutorial-tip').waitFor({ state: 'visible', timeout: 3500 });
    assert.match(await guidancePage.locator('.tutorial-tip').textContent(), /Tap the arrow/i, 'Lv.1 tutorial appears after idle');
    await guidancePage.getByRole('button', { name: 'Settings' }).click();
    const hintButton = guidancePage.locator('.settings-panel').getByRole('button', { name: 'Hint' });
    assert.equal(await hintButton.isDisabled(), false, 'Hint is available during an active attempt');
    await hintButton.click();
    await guidancePage.locator('.hint-toast[data-kind="move"]').waitFor({ state: 'visible', timeout: 7000 });
    assert.equal((await guidancePage.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 0, 'requesting Hint does not launch a move');
    assert.equal(await guidancePage.evaluate(() => window.gameDebug.selectedStackId()), 'stack:0,0', 'Hint highlights the solver-proven first arrow');
    assert.match(await guidancePage.locator('.hint-toast').textContent(), /highlighted arrow/i);
    await guidancePage.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
    await guidancePage.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won', null, { timeout: 7000 });
    assert.equal((await guidancePage.evaluate(() => window.gameDebug.snapshot())).settings.tutorialCompleted, true, 'first move completes the tutorial');
    await guidancePage.reload();
    await guidancePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    await guidancePage.waitForTimeout(2200);
    assert.equal(await guidancePage.locator('.tutorial-tip').isVisible(), false, 'completed tutorial stays hidden after reload');
    await guidancePage.evaluate(() => window.gameDebug.setLevelById('level-002'));
    await guidancePage.evaluate(() => window.gameDebug.launch({ u: 0, v: 2 }));
    await guidancePage.waitForFunction(() => window.gameDebug.snapshot().phase === 'Idle');
    await guidancePage.getByRole('button', { name: 'Settings' }).click();
    await guidancePage.locator('.settings-panel').getByRole('button', { name: 'Hint' }).click();
    await guidancePage.locator('.hint-toast[data-kind="move"]').waitFor({ state: 'visible', timeout: 7000 });
    assert.equal(await guidancePage.evaluate(() => window.gameDebug.selectedStackId()), 'stack:2,0', 'Hint finds a proven move from the changed level-2 state');
    assert.equal((await guidancePage.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 1, 'Hint leaves the existing move history unchanged');
    await guidancePage.evaluate(() => {
      window.gameDebug.setLevelById('level-002');
      window.gameDebug.requestHint();
      window.gameDebug.setLevelById('level-001');
    });
    await guidancePage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-001' && window.gameDebug.snapshot().phase === 'Idle');
    await guidancePage.waitForTimeout(500);
    assert.equal((await guidancePage.evaluate(() => window.gameDebug.snapshot())).hintView.kind, 'idle', 'changing levels cancels an in-flight hint and ignores its result');
    await guidancePage.evaluate(() => window.gameDebug.loadLevel({
      schemaVersion: 1, id: 'deadlock-test', title: 'Deadlock test',
      cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 1, v: 0, kind: 'normal' }],
      stacks: [{ u: 0, v: 0, height: 1 }, { u: 1, v: 0, height: 1 }],
      totalTiles: 2, cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
    }));
    await guidancePage.locator('.hint-toast[data-kind="deadlock"]').waitFor({ state: 'visible', timeout: 2500 });
    assert.match(await guidancePage.locator('.hint-toast').textContent(), /Try undoing a move/i, 'automatic deadlock notice appears only after the stable delay');
    await guidancePage.close();

    const audioPage = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    await audioPage.goto(baseUrl);
    await audioPage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    assert.equal((await audioPage.evaluate(() => window.gameDebug.audioState())).unlocked, false, 'audio stays locked until a user gesture');
    assert.equal(await audioPage.evaluate(() => window.gameDebug.playAudio('launch')), false, 'autoplay cannot play before a gesture');
    await audioPage.getByRole('button', { name: 'Settings' }).click();
    await audioPage.waitForFunction(() => window.gameDebug.audioState().unlocked);
    assert.equal(await audioPage.evaluate(() => window.gameDebug.playAudio('merge')), true, 'audio plays after a trusted user gesture');
    await audioPage.locator('.settings-panel').getByLabel('Sound effects').uncheck();
    assert.equal(await audioPage.evaluate(() => window.gameDebug.playAudio('launch')), false, 'mute stops effects without affecting gameplay');
    await audioPage.evaluate(() => window.gameDebug.flushPersistence());
    await audioPage.reload();
    await audioPage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    assert.equal((await audioPage.evaluate(() => window.gameDebug.audioState())).unlocked, false, 'reload does not restore playback without a new gesture');
    assert.equal((await audioPage.evaluate(() => window.gameDebug.snapshot())).settings.soundEnabled, false, 'mute survives reload');
    await audioPage.close();

    const matrixPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    matrixPage.setDefaultTimeout(7000);
    await matrixPage.goto(baseUrl);
    await matrixPage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    for (const viewport of [
      { width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 },
      { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 },
    ]) {
      await matrixPage.setViewportSize(viewport);
      const layout = await matrixPage.evaluate(() => {
        const main = document.querySelector('main').getBoundingClientRect();
        const undo = document.querySelector('.hud-undo').getBoundingClientRect();
        const point = window.gameDebug.pointForStack(window.gameDebug.selectedStackId());
        return { main: { x: main.x, y: main.y, right: main.right, bottom: main.bottom }, undo: { x: undo.x, y: undo.y, right: undo.right, bottom: undo.bottom, width: undo.width, height: undo.height }, viewport: { width: innerWidth, height: innerHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, hit: window.gameDebug.pickStack(point) };
      });
      assert.equal(layout.horizontalOverflow, false, `no horizontal overflow at ${viewport.width}x${viewport.height}`);
      assert.ok(layout.main.x >= -1 && layout.main.y >= -1 && layout.main.right <= viewport.width + 1 && layout.main.bottom <= viewport.height + 1, `portrait game frame fits ${viewport.width}x${viewport.height}`);
      assert.ok(layout.undo.width >= 44 && layout.undo.height >= 44 && layout.undo.x >= layout.main.x && layout.undo.right <= layout.main.right && layout.undo.bottom <= layout.main.bottom, `Undo remains reachable at ${viewport.width}x${viewport.height}`);
      assert.equal(layout.hit, await matrixPage.evaluate(() => window.gameDebug.selectedStackId()), `selected keyboard target remains pickable at ${viewport.width}x${viewport.height}`);
      await matrixPage.getByRole('button', { name: 'Settings' }).click();
      await matrixPage.locator('.settings-panel').waitFor({ state: 'visible' });
      const card = await matrixPage.locator('.settings-card').boundingBox();
      assert.ok(card, `settings card has a hit area at ${viewport.width}x${viewport.height}`);
      assert.ok(card.x >= layout.main.x && card.y >= layout.main.y && card.x + card.width <= layout.main.right && card.y + card.height <= layout.main.bottom, `settings fit at ${viewport.width}x${viewport.height}`);
      await matrixPage.keyboard.press('Escape');
    }
    const description = await matrixPage.locator('#board-description').textContent();
    assert.match(description, /Level 1.*0 of 4.*Arrow 1.*coordinates 0, 0.*height 1.*direction/i, 'Canvas description exposes level, progress and active-arrow coordinates/height/direction');
    assert.equal(await matrixPage.locator('canvas').getAttribute('aria-describedby'), 'board-description');
    await matrixPage.close();

    const savePage = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    await savePage.goto(baseUrl);
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    await savePage.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    let restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    const persistedSave = await savePage.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('white-tower', 1);
      request.onsuccess = () => { const get = request.result.transaction('save', 'readonly').objectStore('save').get('white-tower.save.v1'); get.onsuccess = () => resolve(get.result); get.onerror = () => resolve({ error: String(get.error) }); };
      request.onerror = () => resolve({ error: String(request.error) });
    }));
    assert.equal(restored.phase, 'Won', `reload during animation restores the committed route result: ${JSON.stringify({ restored, persistedSave })}`);
    assert.equal(restored.committedState.moveCount, 1);
    assert.equal(restored.canUndo, true, 'the move preceding the committed result remains undoable');
    assert.deepEqual(restored.completedLevelIds, ['level-001']);
    await savePage.evaluate(() => window.gameDebug.undo());
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.equal(restored.phase, 'Idle', 'Undo state survives reload');
    assert.equal(restored.canUndo, false);
    assert.deepEqual(restored.completedLevelIds, ['level-001'], 'Undo does not revoke completion');
    await savePage.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
    await savePage.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won');
    await savePage.locator('.victory-layer.is-visible').waitFor({ timeout: 1500 });
    await savePage.locator('.next-button:not(.victory-choose)').evaluate(button => button.click());
    await savePage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-002');
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.equal(restored.levelId, 'level-002', 'selected level survives reload');
    assert.deepEqual(restored.completedLevelIds, ['level-001'], 'Next does not duplicate or clear completion');
    assert.equal(restored.unlockedLevel, 2, 'the next level remains unlocked after reload');
    await savePage.getByRole('button', { name: 'Settings' }).click();
    let levelMenu = savePage.locator('.settings-panel');
    await levelMenu.getByRole('button', { name: /Choose level/ }).click();
    assert.equal(await levelMenu.getByRole('button', { name: 'Level 2', exact: true }).isDisabled(), false, 'the next level is selectable after completion');
    await levelMenu.getByRole('button', { name: 'Level 1, Completed', exact: true }).click();
    await savePage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-001');
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    assert.equal((await savePage.evaluate(() => window.gameDebug.snapshot())).levelId, 'level-001', 'a level selected from the menu resumes after reload');
    await savePage.getByRole('button', { name: 'Settings' }).click();
    levelMenu = savePage.locator('.settings-panel');
    await levelMenu.getByRole('button', { name: /Choose level/ }).click();
    await levelMenu.getByRole('button', { name: 'Level 2', exact: true }).click();
    await savePage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-002');
    await savePage.getByRole('button', { name: 'Settings' }).click();
    let preferences = savePage.locator('.settings-panel');
    await preferences.getByLabel('Language').selectOption('ru');
    await preferences.getByLabel('Уменьшить движение').check();
    await preferences.getByLabel('Высокая контрастность').check();
    await savePage.waitForFunction(() => document.querySelector('main').classList.contains('high-contrast'));
    assert.equal(await preferences.getByLabel('Звуковые эффекты').isChecked(), true, 'sound effects default to enabled but remain gesture-gated');
    await savePage.evaluate(() => { const input = document.querySelector('input[aria-label="Громкость"]'); input.value = '0.65'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await preferences.getByLabel('Режим графики').selectOption('2d');
    await savePage.waitForFunction(() => window.gameDebug.rendererInfo().mode === '2d');
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.settings, { language: 'ru', reducedMotion: true, highContrast: true, soundEnabled: true, soundVolume: 0.65, rendererMode: '2d', tutorialCompleted: true }, 'locale, accessibility, sound, renderer preference and tutorial completion survive reload');
    assert.equal(await savePage.evaluate(() => window.gameDebug.rendererInfo().mode), '2d');
    await savePage.getByRole('button', { name: 'Настройки' }).click();
    preferences = savePage.locator('.settings-panel');
    await preferences.locator('select').first().selectOption('en');
    await preferences.getByLabel('Graphics mode').selectOption('auto');
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await preferences.getByRole('button', { name: 'BACK TO GAME' }).click();
    await savePage.evaluate(() => window.gameDebug.setLevelById('level-004'));
    await savePage.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.equal(restored.phase, 'Won', 'reload during the redirected ring route restores the committed result');
    assert.equal(restored.committedState.stacks.reduce((sum, stack) => sum + stack.height, 0), 7, 'the redirected route retains every tile');
    await savePage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('white-tower', 1);
      request.onsuccess = () => {
        const tx = request.result.transaction('save', 'readwrite'); const store = tx.objectStore('save');
        const get = store.get('white-tower.save.v1');
        get.onsuccess = () => store.put({ ...get.result, settings: { language: 'ru', reducedMotion: true, highContrast: true, soundEnabled: false, soundVolume: 0.65, rendererMode: 'auto', tutorialCompleted: true } }, 'white-tower.save.v1');
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }));
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.settings, { language: 'ru', reducedMotion: true, highContrast: true, soundEnabled: false, soundVolume: 0.65, rendererMode: 'auto', tutorialCompleted: true }, 'settings values roundtrip with the save');
    await savePage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('white-tower', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('save', 'readwrite');
        const store = tx.objectStore('save');
        const get = store.get('white-tower.save.v1');
        get.onsuccess = () => { store.put({ ...get.result, levelChecksum: 'bad-content-hash' }, 'white-tower.save.v1'); };
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }));
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.completedLevelIds, ['level-001'], 'invalid state recovery salvages valid campaign progress');
    await savePage.evaluate(() => window.gameDebug.setLevelById('level-002'));
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.completedLevelIds, ['level-001'], 'saving after recovery does not erase prior completion');
    await savePage.getByRole('button', { name: 'Settings' }).click();
    let resetDialog = savePage.locator('.settings-panel');
    await resetDialog.getByRole('button', { name: 'Clear progress' }).click();
    await resetDialog.getByRole('button', { name: 'CANCEL' }).click();
    assert.deepEqual((await savePage.evaluate(() => window.gameDebug.snapshot())).completedLevelIds, ['level-001'], 'cancel preserves already completed progress');
    await resetDialog.locator('select').first().selectOption('ru');
    await resetDialog.getByRole('button', { name: 'Сбросить прогресс' }).click();
    await resetDialog.getByRole('button', { name: 'СБРОСИТЬ ПРОГРЕСС' }).click();
    await savePage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-001' && window.gameDebug.snapshot().unlockedLevel === 1);
    await savePage.evaluate(() => window.gameDebug.flushPersistence());
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.completedLevelIds, [], 'confirmed reset clears campaign progress');
    assert.equal(restored.settings.language, 'ru', 'clearing campaign progress preserves user preferences');
    await savePage.reload();
    await savePage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    restored = await savePage.evaluate(() => window.gameDebug.snapshot());
    assert.deepEqual(restored.completedLevelIds, [], 'confirmed reset survives reload');
    assert.equal(restored.levelId, 'level-001');
    await savePage.close();

    for (const renderer of ['webgl', '2d']) {
    const campaignPage = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    const campaignUrl = new URL(baseUrl);
    campaignUrl.searchParams.set('renderer', renderer);
    await campaignPage.goto(campaignUrl.toString());
    await campaignPage.waitForFunction(() => window.gameDebug?.snapshot().loaded);
    // Complete the preceding levels so the final unlock follows real campaign progress.
    for (let index = 1; index <= 10; index++) {
      const id = `level-${String(index).padStart(3, '0')}`;
      await campaignPage.evaluate(levelId => window.gameDebug.setLevelById(levelId), id);
      const solution = await campaignPage.evaluate(() => window.gameDebug.snapshot().level.knownSolution);
      for (const move of solution) {
        const moving = await campaignPage.evaluate(start => window.gameDebug.launch(start), move);
        await campaignPage.evaluate(generationId => window.gameDebug.finishAnimation(generationId), moving.generationId);
      }
    }
    await campaignPage.evaluate(() => window.gameDebug.setLevelById('level-011'));
    const transitionMove = await campaignPage.evaluate(() => window.gameDebug.snapshot().level.knownSolution[0]);
    await campaignPage.evaluate(move => window.gameDebug.launch(move), transitionMove);
    await campaignPage.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won', null, { timeout: 8000 });
    await campaignPage.getByRole('button', { name: 'NEXT' }).click();
    await campaignPage.waitForFunction(() => window.gameDebug.snapshot().levelId === 'level-012');
    assert.equal(await campaignPage.locator('.hud-level').textContent(), 'Lv.12');
    await campaignPage.screenshot({ path: `docs/reviews/vertical-slice-level12-${renderer}.png` });
    const finalMove = await campaignPage.evaluate(() => window.gameDebug.snapshot().level.knownSolution[0]);
    await campaignPage.evaluate(move => window.gameDebug.launch(move), finalMove);
    await campaignPage.waitForFunction(() => window.gameDebug.snapshot().phase === 'Won', null, { timeout: 8000 });
    await campaignPage.getByRole('button', { name: 'CHOOSE LEVEL' }).waitFor({ timeout: 1500 });
    assert.equal(await campaignPage.locator('.next-button:not(.victory-choose):not([hidden])').count(), 0, 'the final campaign level offers level selection instead of a nonexistent Next');
    await campaignPage.getByRole('button', { name: 'CHOOSE LEVEL' }).click();
    await campaignPage.locator('.settings-panel[aria-labelledby="level-select-title"]').waitFor();
    assert.equal(await campaignPage.locator('.level-select-page .level-card').last().isDisabled(), false);
    await campaignPage.close();
    }

    const deniedStorage = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    await deniedStorage.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    await deniedStorage.goto(baseUrl);
    await deniedStorage.waitForFunction(() => window.gameDebug?.snapshot().loaded && window.gameDebug.persistenceInfo().memoryOnly);
    assert.match(await deniedStorage.locator('#status').textContent(), /Progress is temporary/);
    await deniedStorage.getByRole('button', { name: 'Settings' }).click();
    await deniedStorage.locator('.settings-status.is-warning').waitFor();
    await deniedStorage.getByRole('button', { name: 'Retry storage' }).waitFor();
    await deniedStorage.getByRole('button', { name: 'BACK TO GAME' }).click();
    await deniedStorage.evaluate(() => window.gameDebug.launch({ u: 0, v: 0 }));
    assert.equal((await deniedStorage.evaluate(() => window.gameDebug.snapshot())).committedState.moveCount, 1, 'storage denial does not block a move');
    await deniedStorage.close();

    const unsupported = await browser.newPage();
    await unsupported.goto(`${baseUrl}?renderer=unsupported`);
    await unsupported.waitForFunction(() => document.querySelector('#status')?.textContent.includes('WebGL и Canvas 2D недоступны'));
    assert.equal(await unsupported.locator('#status').getAttribute('role'), 'status');
    await unsupported.close();
    console.log('Desktop/mobile layout, input, stable local saves, memory-only fallback and runtime errors: passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
