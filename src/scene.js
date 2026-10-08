import { loadCatalog, loadLevelAt, loadLevelById } from './content/catalog.ts';
import { validateLevel } from './game/level-schema.js';
import { createGameController } from './game/controller.ts';
import { createRenderView } from './render/presets.ts';
import { createRendererFactory } from './render/renderer-factory.ts';
import { createProjection, worldToScreen } from './render/projection.ts';
import { createAnimationPlayer } from './presentation/animation.ts';

export function createScene(canvas, rendererMode = 'auto') {
  let activeCanvas = canvas;
  let selection = createRendererFactory(canvas, { mode: rendererMode });
  let renderer = selection.renderer;
  const controller = createGameController();
  const animation = createAnimationPlayer({ onComplete: generationId => showSnapshot(controller.finishAnimation(generationId)) });
  let catalog;
  let level;
  let elapsed = 0;
  let revision = 0;
  let disposed = false;
  let towerDemo = false;
  let selectedStackId;
  let nextPending = false;

  function selectableStacks(snapshot = controller.snapshot()) {
    if (snapshot.phase !== 'Idle' || !snapshot.level || !snapshot.displayedState) return [];
    const floors = new Map(snapshot.level.cells.map(cell => [`${cell.u},${cell.v}`, cell]));
    const projection = createProjection(snapshot.level, snapshot.level.totalTiles);
    return snapshot.displayedState.stacks
      .filter(stack => !!stack.launchDirection || floors.get(`${stack.u},${stack.v}`)?.kind === 'redirect')
      .map(stack => ({ stack, center: worldToScreen(stack.u, stack.v, stack.height - 1, projection) }))
      .sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x || a.stack.id.localeCompare(b.stack.id))
      .map(({ stack }) => stack);
  }

  function showSnapshot(snapshot = controller.snapshot()) {
    if (!snapshot.level || !snapshot.committedState || disposed) return;
    revision++;
    const available = selectableStacks(snapshot);
    if (available.length && !available.some(stack => stack.id === selectedStackId)) selectedStackId = available[0]?.id;
    const state = towerDemo
      ? { ...snapshot.committedState, stacks: [{ ...snapshot.committedState.stacks[0], height: snapshot.level.totalTiles }] }
      : snapshot.committedState;
    renderer.setView(createRenderView(snapshot.level, state, revision, selectedStackId));
  }

  function showPresentation(stacks, snapshot = controller.snapshot()) {
    if (!snapshot.level || !snapshot.committedState || disposed) return;
    revision++;
    renderer.setView(createRenderView(snapshot.level, snapshot.committedState, revision, selectedStackId, stacks));
  }

  function selectStack(id) {
    if (!selectableStacks().some(stack => stack.id === id)) return false;
    selectedStackId = id;
    showSnapshot();
    return true;
  }

  function launchStack(id) {
    const stack = selectableStacks().find(item => item.id === id);
    if (!stack) return false;
    selectedStackId = id;
    const started = controller.launch({ u: stack.u, v: stack.v });
    if (started.phase !== 'Animating') return false;
    animation.start({ stacks: started.displayedState.stacks, steps: started.animation.steps, events: started.animation.events, generationId: started.generationId });
    showPresentation(animation.snapshot().stacks, started);
    return true;
  }

  function toggleMenu() {
    const snapshot = controller.snapshot();
    if (snapshot.phase === 'Menu') { showSnapshot(controller.closeMenu()); return true; }
    if (snapshot.phase === 'Idle' || snapshot.phase === 'Won') { showSnapshot(controller.openMenu()); return true; }
    return false;
  }

  function pointForStack(id) {
    const snapshot = controller.snapshot();
    const stack = snapshot.displayedState?.stacks.find(item => item.id === id);
    if (!stack || !snapshot.level) return undefined;
    return worldToScreen(stack.u, stack.v, stack.height - 1, createProjection(snapshot.level, snapshot.level.totalTiles));
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
    animation.reset();
    const current = controller.snapshot();
    if (current.phase === 'Animating') showSnapshot(controller.finishAnimation(current.generationId));
    const nextLevel = await loadLevelById(catalog, id);
    if (disposed) return;
    level = nextLevel;
    towerDemo = false;
    showSnapshot(controller.loadLevel(level));
  }

  async function nextLevel() {
    const snapshot = controller.snapshot();
    if (disposed || snapshot.phase !== 'Won' || nextPending) return { advanced: false, message: 'Next level is not ready.' };
    const currentIndex = catalog?.levels.findIndex(entry => entry.id === snapshot.level?.id) ?? -1;
    const next = catalog?.levels[currentIndex + 1];
    if (!next) return { advanced: false, message: 'More levels are coming soon.' };
    nextPending = true;
    try {
      await setLevelById(next.id);
      return { advanced: true };
    } catch {
      return { advanced: false, message: 'Could not load the next level. Try again.' };
    } finally { nextPending = false; }
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
    selectableStacks,
    selectedStackId() { return selectedStackId; },
    pointForStack,
    selectStack,
    launchStack,
    toggleMenu,
    update(dt) { elapsed += dt; if (controller.snapshot().phase === 'Animating') showPresentation(animation.update(dt).stacks); },
    pause(value) { animation.pause(value); },
    render() { renderer.render(); },
    resize(viewport) { renderer.resize(viewport); },
    reset() {
      elapsed = 0;
      towerDemo = false;
      animation.reset();
      const current = controller.snapshot();
      if (current.phase === 'Animating') controller.finishAnimation(current.generationId);
      if (level) showSnapshot(controller.restart());
    },
    async setLevelById(id) { return setLevelById(id); },
    async nextLevel() { return nextLevel(); },
    debugLoadLevel(raw) {
      const result = validateLevel(raw);
      if (!result.ok) throw new Error(`Invalid debug level: ${result.errors.map(issue => issue.message).join(' ')}`);
      level = result.value;
      towerDemo = false;
      animation.reset();
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
    snapshot() {
      const snapshot = controller.snapshot();
      const levelIndex = catalog?.levels.findIndex(entry => entry.id === snapshot.level?.id) ?? -1;
      return { elapsed, loaded: !!level, levelId: level?.id ?? null, ...snapshot, levelNumber: levelIndex >= 0 ? levelIndex + 1 : 1, levelCount: catalog?.levels.length ?? 0 };
    },
    presentationSnapshot() { return animation.snapshot(); },
    resourceCounts() { return renderer.resourceCounts(); },
    pickStack(point) {
      const snapshot = controller.snapshot();
      if (snapshot.phase !== 'Idle' || !snapshot.level || !snapshot.displayedState) return undefined;
      const id = renderer.pickStack(point, createRenderView(snapshot.level, snapshot.displayedState, revision, selectedStackId));
      return id && selectableStacks(snapshot).some(stack => stack.id === id) ? id : undefined;
    },
    debugLaunch(start) {
      const snapshot = controller.launch(start);
      if (snapshot.phase === 'Animating') {
        animation.start({ stacks: snapshot.displayedState.stacks, steps: snapshot.animation.steps, events: snapshot.animation.events, generationId: snapshot.generationId });
        showPresentation(animation.snapshot().stacks, snapshot);
      } else showSnapshot(snapshot);
      return snapshot;
    },
    debugFinishAnimation(generationId) { animation.reset(); const snapshot = controller.finishAnimation(generationId); showSnapshot(snapshot); return snapshot; },
    undo() { const snapshot = controller.undo(); showSnapshot(snapshot); return snapshot; },
    dispose() {
      if (disposed) return;
      disposed = true;
      animation.dispose();
      controller.dispose();
      renderer.dispose();
    },
  });
}
