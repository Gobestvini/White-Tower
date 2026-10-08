import './style.css';
import { createStepper } from './loop.js';
import { createInput } from './input.js';
import { createPointerInput } from './input/pointer.ts';
import { createGameActions } from './input/game-actions.ts';
import { createScene } from './scene.js';

let canvas = document.querySelector('canvas');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('#status');
const input = createInput();
let scene;
try {
  const initialRendererMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('renderer') ?? 'auto' : 'auto';
  scene = createScene(canvas, initialRendererMode);
  canvas = scene.canvas;
} catch (error) {
  status.textContent = error instanceof Error ? `WebGL недоступен: ${error.message}` : 'WebGL недоступен.';
  throw error;
}
const stepper = createStepper();
let paused = false;
let previous = null;
let frame;
let disposed = false;
let pointerInput;
function installPointerInput() {
  pointerInput?.dispose();
  canvas = scene.canvas;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  pointerInput = createPointerInput(canvas, {
    pickStack: point => scene.pickStack(point),
    activate: stackId => !paused && scene.rendererInfo().supported && scene.launchStack(stackId),
  });
}
installPointerInput();
const gameActions = createGameActions({
  canvas: () => scene.canvas,
  scene,
  enabled: () => !paused && scene.rendererInfo().supported,
  announce: message => { status.textContent = message; },
  reset,
});

function clearTiming() { previous = null; stepper.reset(); input.reset(); }
function resize() {
  canvas = scene.canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scene.resize({ width: canvas.clientWidth, height: canvas.clientHeight, pixelRatio: dpr });
  scene.render();
}
function setPaused(value) {
  paused = value;
  scene.pause(paused || document.hidden);
  clearTiming();
  pauseButton.textContent = paused ? 'Продолжить' : 'Пауза';
  status.textContent = paused ? 'Пауза' : 'Готово';
}
function reset() { scene.reset(); clearTiming(); scene.render(); }
function visibility() { scene.pause(document.hidden || paused); clearTiming(); }
function tick(now) {
  if (disposed) return;
  const delta = previous === null ? 0 : (now - previous) / 1000;
  previous = now;
  let alpha = 0;
  if (!paused && !document.hidden) alpha = stepper.advance(delta, dt => scene.update(dt, input)).alpha;
  scene.render();
  frame = requestAnimationFrame(tick);
}
const toggle = () => setPaused(!paused);
pauseButton.addEventListener('click', toggle);
document.querySelector('#reset').addEventListener('click', reset);
document.addEventListener('visibilitychange', visibility);
window.addEventListener('resize', resize);
resize();
frame = requestAnimationFrame(tick);
scene.ready.then(async () => {
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && params.has('resource-check')) {
    const ids = Array.from({ length: 11 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`);
    for (const id of ids) await scene.setLevelById(id);
    await scene.setLevelById('level-006');
    scene.setTowerDemo(14);
    await new Promise(requestAnimationFrame);
    const before = scene.resourceCounts();
    for (let index = 0; index < 20; index++) await scene.setLevelById(ids[index % ids.length]);
    await scene.setLevelById('level-006');
    scene.setTowerDemo(14);
    await new Promise(requestAnimationFrame);
    const after = scene.resourceCounts();
    const stable = before.geometries === after.geometries && before.textures === after.textures && before.programs === after.programs && before.children === after.children;
    status.textContent = stable
      ? `WebGL resources stable after 20 level changes: ${after.geometries} geometries, ${after.textures} textures, ${after.programs} programs, ${after.children} scene objects.`
      : `WebGL resource count changed: ${JSON.stringify({ before, after })}`;
    return;
  } else {
    const levelId = params.get('level');
    if (levelId) await scene.setLevelById(levelId);
    if (params.has('tower')) scene.setTowerDemo(Number(params.get('tower')) || undefined);
  }
  status.textContent = scene.rendererInfo().message ?? (scene.rendererInfo().mode === '2d' ? 'Упрощённый графический режим.' : 'Готово');
}).catch(error => {
  status.textContent = error instanceof Error ? `Ошибка уровня: ${error.message}` : 'Не удалось загрузить уровень.';
});
function dispose() {
  disposed = true;
  cancelAnimationFrame(frame);
  input.dispose(); pointerInput?.dispose(); gameActions.dispose(); scene.dispose();
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', visibility);
  pauseButton.removeEventListener('click', toggle);
  document.querySelector('#reset').removeEventListener('click', reset);
  if (import.meta.env.DEV) delete window.gameDebug;
}
if (import.meta.env.DEV) {
  window.gameDebug = {
    snapshot: () => ({ ...scene.snapshot(), paused, keys: [...input.keys] }),
    presentationSnapshot: () => scene.presentationSnapshot(),
    reset,
    setLevelById: id => scene.setLevelById(id),
    setTowerDemo: height => scene.setTowerDemo(height),
    resourceCounts: () => scene.resourceCounts(),
    rendererInfo: () => scene.rendererInfo(),
    setRendererMode: mode => { const changed = scene.setRendererMode(mode); if (changed) { installPointerInput(); resize(); status.textContent = scene.rendererInfo().message ?? (scene.rendererInfo().mode === '2d' ? 'Упрощённый графический режим.' : 'Готово'); } return changed; },
    launch: start => scene.debugLaunch(start),
    finishAnimation: generationId => scene.debugFinishAnimation(generationId),
    undo: () => scene.undo(),
    loadLevel: level => scene.debugLoadLevel(level),
    pointForStack: id => scene.pointForStack(id),
    selectedStackId: () => scene.selectedStackId(),
    pickStack: point => scene.pickStack(point),
  };
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
