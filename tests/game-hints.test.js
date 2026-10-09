import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHintService } from '../src/game/hint-service.ts';
import { validateLevel } from '../src/game/level-schema.js';
import { createInitialState } from '../src/game/model.ts';

const level = validateLevel(JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels[0]);
if (!level.ok) throw new Error('Hint fixture did not validate');
const exampleLevel = level.value;
const solved = { status: 'solved', path: [{ u: 0, v: 0 }], visited: 1 };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('hint selects the first proven move without changing game state', async () => {
  const views = [];
  const state = createInitialState(exampleLevel);
  const service = createHintService({ solve: async () => solved, cancel() {}, invalidate() {} }, (view) => views.push(view));
  await service.request(exampleLevel, state, []);
  assert.deepEqual(views.at(-1), { kind: 'move', move: { u: 0, v: 0 } });
  assert.equal(state.moveCount, 0);
  service.dispose();
});

test('proves Undo by solving the previous history snapshot', async () => {
  const views = [];
  const current = { ...createInitialState(exampleLevel), moveCount: 1 };
  const previous = createInitialState(exampleLevel);
  const service = createHintService({ solve: async (_level, state) => state.moveCount ? { status: 'unsolvable', visited: 2 } : solved, cancel() {}, invalidate() {} }, (view) => views.push(view));
  await service.request(exampleLevel, current, [previous]);
  assert.deepEqual(views.at(-1), { kind: 'undo-proven' });
  service.dispose();
});

test('timeout suggests Undo without claiming a deadlock', async () => {
  const views = [];
  const service = createHintService({ solve: async () => ({ status: 'timeout', visited: 20 }), cancel() {}, invalidate() {} }, (view) => views.push(view));
  await service.request(exampleLevel, createInitialState(exampleLevel), [createInitialState(exampleLevel)]);
  assert.deepEqual(views.at(-1), { kind: 'undo-suggestion' });
  service.dispose();
});

test('timeout while checking Undo remains a suggestion, while proven previous unsolvable state is a deadlock', async () => {
  const previous = createInitialState(exampleLevel);
  const current = { ...previous, moveCount: 1 };
  const views = [];
  const timeoutService = createHintService({ solve: async (_level, state) => state.moveCount ? { status: 'unsolvable', visited: 20 } : { status: 'timeout', visited: 20 }, cancel() {}, invalidate() {} }, view => views.push(view));
  await timeoutService.request(exampleLevel, current, [previous]);
  assert.deepEqual(views.at(-1), { kind: 'undo-suggestion' });
  timeoutService.dispose();

  const provenService = createHintService({ solve: async () => ({ status: 'unsolvable', visited: 20 }), cancel() {}, invalidate() {} }, view => views.push(view));
  await provenService.request(exampleLevel, current, [previous]);
  assert.deepEqual(views.at(-1), { kind: 'deadlock' });
  provenService.dispose();
});

test('ignores a late solver answer after cancellation', async () => {
  const views = [];
  const pending = deferred();
  const service = createHintService({ solve: () => pending.promise, cancel() {}, invalidate() {} }, (view) => views.push(view));
  const request = service.request(exampleLevel, createInitialState(exampleLevel), []);
  service.cancel();
  pending.resolve(solved);
  await request;
  assert.deepEqual(views.at(-1), { kind: 'idle' });
  assert.equal(views.some((view) => view.kind === 'move'), false);
  service.dispose();
});

test('shows a delayed searching state and clears it on cancellation', async () => {
  const views = [];
  const pending = deferred();
  const service = createHintService({ solve: () => pending.promise, cancel() {}, invalidate() {} }, (view) => views.push(view));
  service.request(exampleLevel, createInitialState(exampleLevel), []);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.ok(views.some((view) => view.kind === 'searching'));
  service.cancel();
  assert.deepEqual(views.at(-1), { kind: 'idle' });
  pending.resolve(solved);
  service.dispose();
});
