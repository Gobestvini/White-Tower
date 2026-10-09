import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendererFactory } from '../src/render/renderer-factory.ts';
import { createCanvasRenderer } from '../src/render/canvas-renderer.ts';
import { createProjection, pitchScreenPoint, worldToScreen } from '../src/render/projection.ts';

function stubRenderer() {
  return { setView() {}, resize() {}, render() {}, pickStack() {}, resourceCounts: () => ({ geometries: 0, textures: 0, programs: 0, children: 0 }), dispose() {} };
}

function makeCanvas(parentNode = null) {
  return {
    parentNode,
    cloneNode() { return makeCanvas(parentNode); },
    getContext(kind) { return kind === '2d' ? {} : null; },
  };
}

test('factory retries failed WebGL on a fresh canvas and selects Canvas 2D', () => {
  const parent = { child: null, replaceChild(next, previous) { assert.equal(this.child, previous); this.child = next; next.parentNode = this; } };
  const canvas = makeCanvas(parent); parent.child = canvas;
  let attemptedCanvas;
  const selected = createRendererFactory(canvas, {
    webglFactory(candidate) { attemptedCanvas = candidate; throw new Error('no WebGL'); },
    canvasFactory(candidate) { assert.notEqual(candidate, attemptedCanvas); return stubRenderer(); },
  });
  assert.equal(selected.mode, '2d');
  assert.equal(selected.supported, true);
  assert.equal(parent.child, selected.canvas);
  assert.notEqual(selected.canvas, canvas);
});

test('factory reports Unsupported after both graphics contexts fail', () => {
  const parent = { child: null, replaceChild(next, previous) { assert.equal(this.child, previous); this.child = next; next.parentNode = this; } };
  const canvas = makeCanvas(parent); parent.child = canvas;
  const selected = createRendererFactory(canvas, {
    webglFactory() { throw new Error('no WebGL'); },
    canvasFactory() { throw new Error('no Canvas 2D'); },
  });
  assert.equal(selected.supported, false);
  assert.equal(selected.mode, 'auto');
  assert.match(selected.message, /WebGL или Canvas 2D/);
  assert.equal(parent.child, selected.canvas);
});

test('forced Canvas mode shares projection, hit location and preserves disposable renderer contract', () => {
  const calls = [];
  const context = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, { get(target, property) { return target[property] ?? ((...args) => calls.push([property, ...args])); }, set(target, property, value) { target[property] = value; return true; } });
  const canvas = { getContext: kind => kind === '2d' ? context : null, width: 0, height: 0 };
  const renderer = createCanvasRenderer(canvas);
  const level = { id: 'one', totalTiles: 1, cells: [{ u: 0, v: 0, kind: 'normal' }] };
  const view = { revision: 0, level, stacks: [{ id: 'stack:0,0', u: 0, v: 0, height: 1, launchDirection: 'SE' }] };
  const projection = createProjection(level);
  const center = worldToScreen(0, 0, 0, projection);
  assert.equal(renderer.pickStack(pitchScreenPoint(center), view), 'stack:0,0');
  renderer.setView(view); renderer.resize({ width: 720, height: 1280, pixelRatio: 1 }); renderer.render();
  assert.ok(calls.some(([operation]) => operation === 'fill'));
  renderer.dispose(); renderer.dispose();
  assert.deepEqual(renderer.resourceCounts(), { geometries: 0, textures: 0, programs: 0, children: 0 });
});
