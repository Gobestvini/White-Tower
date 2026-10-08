import { loadCatalog, loadLevelAt, loadLevelById } from './content/catalog.ts';
import { validateLevel } from './game/level-schema.js';
import { createGameController } from './game/controller.ts';
import { createRenderView } from './render/presets.ts';
import { createRendererFactory } from './render/renderer-factory.ts';

export function createScene(canvas, rendererMode = 'auto') {
  let activeCanvas = canvas;
  let selection = createRendererFactory(canvas, { mode: rendererMode });
  let renderer = selection.renderer;
  const controller = createGameController();
  let catalog;
  let level;
  let elapsed = 0;
  let revision = 0;
  let disposed = false;
  let towerDemo = false;

  function showSnapshot(snapshot = controller.snapshot()) {
    if (!snapshot.level || !snapshot.committedState || disposed) return;
    revision++;
    const state = towerDemo
      ? { ...snapshot.committedState, stacks: [{ ...snapshot.committedState.stacks[0], height: snapshot.level.totalTiles }] }
      : snapshot.committedState;
    renderer.setView(createRenderView(snapshot.level, state, revision));
  }

  function setRendererMode(mode) {
    const snapshot = controller.snapshot();
    if (disposed || (snapshot.phase !== 'Idle' && snapshot.phase !== 'Won')) return false;
    const next = createRendererFactory(activeCanvas, { mode, replaceCanvas: true });
    const previous = renderer;
    selection = next;
    renderer = next.renderer;
    activeCanvas = next.canvas;
    previous?.dispose();
    showSnapshot(snapshot);
    return true;
  }

  async function setLevelById(id) {
    if (!catalog || disposed) throw new Error('Каталог ещё загружается.');
    const nextLevel = await loadLevelById(catalog, id);
    if (disposed) return;
    level = nextLevel;
    towerDemo = false;
    showSnapshot(controller.loadLevel(level));
  }

  const ready = loadCatalog()
    .then(async loadedCatalog => {
      if (disposed) return;
      catalog = loadedCatalog;
      level = await loadLevelAt(catalog, 0);
      if (disposed) return;
      showSnapshot(controller.loadLevel(level));
      return level;
    });

  return Object.freeze({
    ready,
    get canvas() { return activeCanvas; },
    rendererInfo() { return Object.freeze({ mode: selection.mode, supported: selection.supported, message: selection.message }); },
    setRendererMode,
    update(dt) { elapsed += dt; },
    render() { renderer.render(); },
    resize(viewport) { renderer.resize(viewport); },
    reset() {
      elapsed = 0;
      towerDemo = false;
      if (level) showSnapshot(controller.restart());
    },
    async setLevelById(id) { return setLevelById(id); },
    debugLoadLevel(raw) {
      const result = validateLevel(raw);
      if (!result.ok) throw new Error(`Invalid debug level: ${result.errors.map(issue => issue.message).join(' ')}`);
      level = result.value;
      towerDemo = false;
      const snapshot = controller.loadLevel(level);
      showSnapshot(snapshot);
      return snapshot;
    },
    setTowerDemo(height) {
      if (!level) return false;
      towerDemo = true;
      const snapshot = controller.snapshot();
      if (snapshot.level && snapshot.committedState) {
        const first = snapshot.committedState.stacks[0];
        if (first) {
          revision++;
          const state = { ...snapshot.committedState, stacks: [{ ...first, height: Math.max(1, Math.min(height ?? level.totalTiles, level.totalTiles)) }] };
          renderer.setView(createRenderView(snapshot.level, state, revision));
        }
      }
      return true;
    },
    snapshot() { return { elapsed, loaded: !!level, levelId: level?.id ?? null, ...controller.snapshot() }; },
    resourceCounts() { return renderer.resourceCounts(); },
    pickStack(point) {
      const snapshot = controller.snapshot();
      if (!snapshot.level || !snapshot.committedState) return undefined;
      return renderer.pickStack(point, createRenderView(snapshot.level, snapshot.committedState, revision));
    },
    debugLaunch(start) { const snapshot = controller.launch(start); showSnapshot(snapshot); return snapshot; },
    debugFinishAnimation(generationId) { const snapshot = controller.finishAnimation(generationId); showSnapshot(snapshot); return snapshot; },
    undo() { const snapshot = controller.undo(); showSnapshot(snapshot); return snapshot; },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.dispose();
      renderer.dispose();
    },
  });
}
