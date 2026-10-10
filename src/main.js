import './style.css';
import './casual.css';
import './concept-layout.css';
import { createStepper } from './loop.js';
import { createInput } from './input.js';
import { createPointerInput } from './input/pointer.ts';
import { createGameActions } from './input/game-actions.ts';
import { createScene } from './scene.js';
import { createHud } from './ui/hud.ts';
import { keyboardAnnouncement } from './ui/accessibility.ts';
import { createAudio } from './audio/audio.ts';
import { createServiceScreen } from './ui/service-screen.ts';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Online play remains available when the browser blocks offline storage.
    });
  }, { once: true });
}

let canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const input = createInput();
const audio = createAudio();
const serviceScreen = createServiceScreen(document.querySelector('main'));
let scene;
try {
  const initialRendererMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('renderer') ?? 'auto' : 'auto';
  scene = createScene(canvas, initialRendererMode, { audio });
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
const hud = createHud({
  root: document.querySelector('#hud'),
  onReset: reset,
  onUndo: () => scene.undo(),
  onNext: () => { audio.play('ui'); return scene.nextLevel(); },
  onMenu: () => scene.toggleMenu(),
  getSettings: () => scene.snapshot().settings,
  onSettings: nextSettings => {
    const previousCanvas = scene.canvas;
    scene.updateSettings(nextSettings);
    audio.configure(nextSettings);
    if (scene.canvas !== previousCanvas) { installPointerInput(); resize(); }
  },
  onSelectLevel: id => { audio.play('ui'); void scene.selectLevel(id).catch(() => { status.textContent = 'Could not load that level. Select it again to retry.'; }); },
  onClearProgress: () => { audio.play('ui'); void scene.clearProgress().then(() => { installPointerInput(); resize(); }); },
  onRetry: () => window.location.reload(),
  onChooseLevels: () => { scene.toggleMenu(); },
  onHint: () => { audio.play('ui'); scene.requestHint(); },
  onExportProgress: () => scene.exportProgress(),
  onImportProgress: raw => scene.importProgress(raw),
});
const gameActions = createGameActions({
  canvas: () => scene.canvas,
  scene,
  enabled: () => !paused && scene.rendererInfo().supported,
  announce: (action, index, count) => { status.textContent = keyboardAnnouncement(scene.snapshot().settings.language, action, index, count); },
  reset,
});

function clearTiming() { previous = null; stepper.reset(); input.reset(); }
function unlockAudio() { void audio.unlock(); }
document.addEventListener('pointerdown', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });
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
  status.textContent = paused ? 'Пауза' : 'Готово';
}
function reset() { audio.play('ui'); scene.reset(); clearTiming(); scene.render(); }
function visibility() { scene.pause(document.hidden || paused); void audio.setVisible(!document.hidden); clearTiming(); }
function tick(now) {
  if (disposed) return;
  const delta = previous === null ? 0 : (now - previous) / 1000;
  previous = now;
  let alpha = 0;
  if (!paused && !document.hidden) alpha = stepper.advance(delta, dt => scene.update(dt, input)).alpha;
  hud.update(scene.snapshot(), scene.presentationSnapshot(), !paused && !document.hidden ? Math.min(delta, 0.1) : 0);
  serviceScreen.update(scene.snapshot().loaded, scene.rendererInfo().supported, scene.snapshot().settings.language);
  const persistence = scene.persistenceInfo();
  if (persistence.memoryOnly) status.textContent = scene.snapshot().settings.language === 'ru' ? 'Прогресс временный: хранилище браузера недоступно.' : 'Progress is temporary because browser storage is unavailable.';
  else if (persistence.recoveryNotice) status.textContent = persistence.recoveryNotice;
  scene.render();
  frame = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('resize', resize);
resize();
frame = requestAnimationFrame(tick);
scene.ready.then(async () => {
  audio.configure(scene.snapshot().settings);
  if (document.hidden) void audio.setVisible(false);
  installPointerInput(); resize();
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
  serviceScreen.fail();
});
function dispose() {
  disposed = true;
  cancelAnimationFrame(frame);
  input.dispose(); pointerInput?.dispose(); gameActions.dispose(); hud.dispose(); serviceScreen.dispose(); scene.dispose();
  document.removeEventListener('pointerdown', unlockAudio, true); document.removeEventListener('keydown', unlockAudio, true); void audio.dispose();
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', visibility);
  if (import.meta.env.DEV) delete window.gameDebug;
}
if (import.meta.env.DEV) {
  window.gameDebug = {
    snapshot: () => ({ ...scene.snapshot(), paused, keys: [...input.keys] }),
    presentationSnapshot: () => scene.presentationSnapshot(),
    setPaused: value => setPaused(!!value),
    reset,
    setLevelById: id => scene.setLevelById(id),
    setTowerDemo: height => scene.setTowerDemo(height),
    resourceCounts: () => scene.resourceCounts(),
    rendererInfo: () => scene.rendererInfo(),
    setRendererMode: mode => { const changed = scene.setRendererMode(mode); if (changed) { installPointerInput(); resize(); status.textContent = scene.rendererInfo().message ?? (scene.rendererInfo().mode === '2d' ? 'Упрощённый графический режим.' : 'Готово'); } return changed; },
    launch: start => scene.debugLaunch(start),
    finishAnimation: generationId => scene.debugFinishAnimation(generationId),
    undo: () => scene.undo(),
    persistenceInfo: () => scene.persistenceInfo(),
    flushPersistence: () => scene.flushPersistence(),
    exportProgress: () => scene.exportProgress(),
    importProgress: raw => scene.importProgress(raw),
    loadLevel: level => scene.debugLoadLevel(level),
    pointForStack: id => scene.pointForStack(id),
    selectedStackId: () => scene.selectedStackId(),
    pickStack: point => scene.pickStack(point),
    requestHint: () => scene.requestHint(),
    audioState: () => audio.snapshot(),
    playAudio: effect => audio.play(effect),
  };
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
