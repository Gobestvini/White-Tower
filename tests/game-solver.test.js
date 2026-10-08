import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState, validateLevel } from '../src/game/level-schema.js';
import { createSolverClient } from '../src/game/solver-client.js';
import { replaySolution, solve, validateKnownSolution } from '../src/game/solver.js';

const fixtures = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels;
function level(index) {
  const result = validateLevel(fixtures[index]);
  assert.ok(result.ok);
  return result.value;
}

test('solver finds shortest paths for A–D, replays them, and checks known solution/par', async () => {
  for (let index = 0; index < fixtures.length; index++) {
    const data = level(index);
    const initial = createInitialState(data);
    const result = await solve(data, initial, { requestId: `example-${index}`, generationId: 1, budgetMs: 1000 });
    assert.equal(result.status, 'solved', `level ${data.id} returned ${result.status}`);
    if (result.status !== 'solved') continue;
    assert.equal(result.path.length, data.parMoves);
    assert.equal(result.matchesPar, true);
    assert.equal(result.shortest, true);
    assert.ok(replaySolution(data, initial, result.path));
    assert.equal(validateKnownSolution(data, initial, data.knownSolution).valid, true);
  }
});

test('only exhaustive search proves two passive stacks unsolvable', async () => {
  const result = validateLevel({
    schemaVersion: 1, id: 'passive', title: 'Passive stacks',
    cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 1, v: 0, kind: 'normal' }],
    stacks: [{ u: 0, v: 0, height: 1 }, { u: 1, v: 0, height: 1 }], totalTiles: 2,
    cameraPreset: 'reference', tutorialKey: null, parMoves: 0, knownSolution: [{ u: 0, v: 0 }],
  });
  assert.ok(result.ok);
  const outcome = await solve(result.value, createInitialState(result.value), { requestId: 'unsolvable', budgetMs: 1000 });
  assert.equal(outcome.status, 'unsolvable');
  assert.equal(outcome.explored, 1);
});

test('zero budget, cancellation, and state-budget exhaustion are separate from unsolvable', async () => {
  const data = level(0);
  const initial = createInitialState(data);
  assert.equal((await solve(data, initial, { requestId: 'zero', budgetMs: 0 })).status, 'timeout');
  assert.equal((await solve(data, initial, { requestId: 'cancel', budgetMs: 1000, isCancelled: () => true })).status, 'cancelled');
  const cap = await solve(level(1), createInitialState(level(1)), { requestId: 'cap', budgetMs: 1000, maxStates: 1 });
  assert.equal(cap.status, 'timeout');
});

test('invalid known solution is rejected and a solved initial state needs no moves', async () => {
  const data = level(0);
  assert.equal(validateKnownSolution(data, createInitialState(data), [{ u: 2, v: 0 }]).valid, false);
  const solved = { ...createInitialState(data), stacks: [{ ...data.stacks[0], height: 4 }] };
  const result = await solve(data, solved, { requestId: 'already-won', budgetMs: 100 });
  assert.equal(result.status, 'solved');
  if (result.status === 'solved') assert.deepEqual(result.path, []);
});

class FakeWorker {
  onmessage = null;
  onerror = null;
  messages = [];
  terminated = false;
  postMessage(message) {
    this.messages.push(message);
    if (message.type === 'solve') this.request = message;
  }
  finish(status = 'solved') {
    const request = this.request;
    this.onmessage?.({ data: { status, requestId: request.requestId, generationId: request.generationId, explored: 1, elapsedMs: 2, path: [], shortest: true, matchesPar: true } });
  }
  terminate() { this.terminated = true; }
}

test('worker client cancels stale generations and resolves pending requests on dispose', async () => {
  const fake = new FakeWorker();
  const client = createSolverClient(() => fake);
  const data = level(0);
  const stale = client.solve(data, createInitialState(data), { requestId: 'old', generationId: 1, budgetMs: 1000 });
  client.invalidate(2);
  assert.equal((await stale).status, 'cancelled');
  fake.finish();
  const pending = client.solve(data, createInitialState(data), { requestId: 'current', generationId: 2, budgetMs: 1000 });
  client.dispose();
  assert.equal((await pending).status, 'cancelled');
  assert.equal(fake.terminated, true);
});
