import test from 'node:test';
import assert from 'node:assert/strict';
import { gameIntentForKey } from '../src/input/game-actions.ts';
import { createPointerInput } from '../src/input/pointer.ts';
import { clientToArtboard, compareBackToFront, pickVisibleStack, TILE_RADIUS, TILE_SIDE_DEPTH } from '../src/render/projection.ts';

test('keyboard intents require game focus and leave browser/editor keys alone', () => {
  assert.equal(gameIntentForKey({ key: 'ArrowRight', code: 'ArrowRight' }, false), undefined);
  assert.equal(gameIntentForKey({ key: 'r', code: 'KeyR' }, true, true), undefined);
  assert.equal(gameIntentForKey({ key: 'Tab', code: 'Tab' }, true), undefined);
  assert.equal(gameIntentForKey({ key: 'ArrowRight', code: 'ArrowRight' }, true), 'next');
  assert.equal(gameIntentForKey({ key: 'Enter', code: 'Enter' }, true), 'launch');
  assert.equal(gameIntentForKey({ key: 'z', code: 'KeyZ', ctrlKey: true }, true), 'undo');
  assert.equal(gameIntentForKey({ key: 'Escape', code: 'Escape' }, true), 'menu');
});

test('CSS client coordinates map through letterbox and ignore bars at any viewport scale', () => {
  assert.deepEqual(clientToArtboard(195, 422, { left: 0, top: 0, width: 390, height: 844 }), { x: 360, y: 640 });
  assert.deepEqual(clientToArtboard(360, 640, { left: 0, top: 0, width: 720, height: 1280 }), { x: 360, y: 640 });
  assert.equal(clientToArtboard(195, 20, { left: 0, top: 0, width: 390, height: 844 }), undefined);
  assert.equal(clientToArtboard(0, 0, { left: 0, top: 0, width: 0, height: 0 }), undefined);
});

test('picking follows visible front-to-back order and ignores side faces', () => {
  const projection = { scale: 0.5, originX: 0, originY: 0, layerRise: 12.8 };
  const stacks = [{ id: 'front', u: 0, v: 0, height: 2 }, { id: 'rear', u: 1, v: 0, height: 1 }];
  assert.deepEqual([...stacks].sort(compareBackToFront).map(stack => stack.id), ['rear', 'front']);
  assert.equal(pickVisibleStack({ x: 18, y: -18 }, stacks, projection), 'front', 'the visible front stack owns the overlapping region');
  assert.equal(pickVisibleStack({ x: 0, y: (TILE_RADIUS + TILE_SIDE_DEPTH / 2) * projection.scale }, stacks, projection), undefined, 'a side face blocks picking through it');
  assert.equal(pickVisibleStack({ x: 64, y: -36 }, stacks, projection), 'rear', 'the exposed part of the rear tile remains clickable');
});

class PointerEventStub extends Event {
  constructor(type, { pointerId = 1, pointerType = 'touch', isPrimary = true, button = 0, x = 100, y = 100 } = {}) {
    super(type, { cancelable: true });
    Object.assign(this, { pointerId, pointerType, isPrimary, button, clientX: x, clientY: y });
  }
}

class CanvasStub extends EventTarget {
  style = { touchAction: '' };
  captures = new Set();
  getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 1280 }; }
  focus() {}
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

test('pointer input ignores cancel, drag, secondary contact and duplicate tap; disposal removes listeners', () => {
  const canvas = new CanvasStub();
  const windowTarget = new EventTarget();
  const documentTarget = Object.assign(new EventTarget(), { hidden: false });
  const hits = [];
  const pointer = createPointerInput(canvas, {
    pickStack: point => Math.abs(point.x - 100) < 2 && Math.abs(point.y - 100) < 2 ? 'stack' : undefined,
    activate: id => { hits.push(id); return true; },
    environment: { windowTarget, documentTarget },
  });
  const send = (type, init) => canvas.dispatchEvent(new PointerEventStub(type, init));
  send('pointerdown', { x: 100, y: 100 }); send('pointercancel', { x: 100, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); windowTarget.dispatchEvent(new Event('blur')); send('pointerup', { x: 100, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); documentTarget.hidden = true; documentTarget.dispatchEvent(new Event('visibilitychange')); documentTarget.hidden = false; send('pointerup', { x: 100, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); send('pointerup', { x: 120, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); send('pointerdown', { pointerId: 2, isPrimary: false, x: 100, y: 100 });
  send('pointerup', { pointerId: 2, isPrimary: false, x: 100, y: 100 }); send('pointercancel', { x: 100, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); send('pointerup', { x: 100, y: 100 });
  send('pointerdown', { x: 100, y: 100 }); send('pointerup', { x: 100, y: 100 });
  assert.deepEqual(hits, ['stack']);
  assert.equal(canvas.style.touchAction, 'none');
  pointer.dispose();
  assert.equal(canvas.style.touchAction, '');
  send('pointerdown', { x: 100, y: 100 }); send('pointerup', { x: 100, y: 100 });
  assert.deepEqual(hits, ['stack']);
});
