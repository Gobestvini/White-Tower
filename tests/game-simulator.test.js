import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState, validateLevel } from '../src/game/level-schema.js';
import { simulateMove } from '../src/game/simulator.js';

const examples = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels;
function levelAt(index) {
  const result = validateLevel(examples[index]);
  assert.ok(result.ok);
  return result.value;
}
function play(level, state, ...coordinates) {
  for (const { u, v } of coordinates) {
    const result = simulateMove(level, state, { u, v });
    assert.equal(result.accepted, true, result.accepted ? '' : result.reason);
    state = result.nextState;
  }
  return state;
}

test('A gathers all four tiles in one route and reports each merge counter', () => {
  const level = levelAt(0);
  const input = createInitialState(level);
  const result = simulateMove(level, input, { u: 0, v: 0 });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.deepEqual(result.nextState.stacks.map(({ u, v, height }) => [u, v, height]), [[3, 0, 4]]);
  assert.deepEqual(result.steps.filter(step => step.absorbed).map(step => step.counter), [2, 3, 4]);
  assert.equal(result.won, true);
  assert.equal(input.stacks.length, 4);
});

test('both B branch orders collect all five tiles at the origin', () => {
  const level = levelAt(1);
  for (const order of [[{ u: 2, v: 0 }, { u: 0, v: 2 }], [{ u: 0, v: 2 }, { u: 2, v: 0 }]]) {
    const state = play(level, createInitialState(level), ...order);
    assert.deepEqual(state.stacks.map(({ u, v, height }) => [u, v, height]), [[0, 0, 5]]);
  }
});

test('C follows N then NE then NW to one stack of four', () => {
  const level = levelAt(2);
  const state = play(level, createInitialState(level), { u: 1, v: 1 }, { u: 0, v: 1 }, { u: 1, v: 0 });
  assert.deepEqual(state.stacks.map(({ u, v, height }) => [u, v, height]), [[0, 0, 4]]);
});

test('D turns around the hole, revisits its vacated start and gathers five', () => {
  const level = levelAt(3);
  const result = simulateMove(level, createInitialState(level), { u: 0, v: 0 });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.deepEqual(result.nextState.stacks.map(({ u, v, height }) => [u, v, height]), [[0, 0, 5]]);
  assert.deepEqual(result.events.filter(event => event.type === 'turn').map(event => event.direction), ['SW', 'NW', 'NE']);
});

test('a stack crosses empty floor and consumes a target arrow on merge', () => {
  const raw = {
    schemaVersion: 1, id: 'empty-route', title: 'Empty route',
    cells: [0, 1, 2, 3].map(u => ({ u, v: 0, kind: 'normal' })),
    stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 3, v: 0, height: 1, launchDirection: 'NW' }],
    totalTiles: 2, cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
  };
  const parsed = validateLevel(raw);
  assert.ok(parsed.ok);
  const result = simulateMove(parsed.value, createInitialState(parsed.value), { u: 0, v: 0 });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.deepEqual(result.nextState.stacks.map(({ u, v, height, launchDirection }) => [u, v, height, launchDirection]), [[3, 0, 2, undefined]]);
  assert.equal(result.steps.length, 3);
  assert.equal(result.events.some(event => event.type === 'merge'), true);
});

test('starting floor redirect overrides launch arrow and can activate an unarrowed stack', () => {
  const raw = {
    schemaVersion: 1, id: 'start-redirect', title: 'Start redirect',
    cells: [{ u: 0, v: 0, kind: 'redirect', direction: 'SW' }, { u: 0, v: 1, kind: 'normal' }, { u: 10, v: 10, kind: 'normal' }],
    stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 10, v: 10, height: 1 }],
    totalTiles: 2, cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
  };
  const parsed = validateLevel(raw);
  assert.ok(parsed.ok);
  const result = simulateMove(parsed.value, createInitialState(parsed.value), { u: 0, v: 0 });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.deepEqual(result.steps[0]?.to, { u: 0, v: 1 });
  const unarrowed = { ...raw, stacks: raw.stacks.map(stack => stack.u === 0 ? { u: 0, v: 0, height: 1 } : stack) };
  const second = validateLevel(unarrowed);
  assert.ok(second.ok);
  assert.equal(simulateMove(second.value, createInitialState(second.value), { u: 0, v: 0 }).accepted, true);
});

test('an impossible first step leaves state untouched and a blocked diagonal destination rejects', () => {
  const blockedStart = {
    schemaVersion: 1, id: 'blocked', title: 'Blocked', cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 10, v: 10, kind: 'normal' }],
    stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 10, v: 10, height: 1 }], totalTiles: 2,
    cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
  };
  const parsed = validateLevel(blockedStart);
  assert.ok(parsed.ok);
  const state = createInitialState(parsed.value);
  const result = simulateMove(parsed.value, state, { u: 0, v: 0 });
  assert.equal(result.accepted, false);
  if (!result.accepted) assert.equal(result.reason, 'blocked');
  assert.equal(state.stacks[0]?.launchDirection, 'SE');

  const blockedDiagonal = { ...blockedStart, cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 1, v: 0, kind: 'blocked' }, { u: 10, v: 10, kind: 'normal' }] };
  const diagonal = validateLevel(blockedDiagonal);
  assert.ok(diagonal.ok);
  const diagonalResult = simulateMove(diagonal.value, createInitialState(diagonal.value), { u: 0, v: 0 });
  assert.equal(diagonalResult.accepted, false);
});

test('a complete redirect cycle rejects atomically', () => {
  const raw = {
    schemaVersion: 1, id: 'cycle', title: 'Cycle',
    cells: [
      { u: 0, v: 0, kind: 'redirect', direction: 'SE' }, { u: 1, v: 0, kind: 'redirect', direction: 'SW' },
      { u: 1, v: 1, kind: 'redirect', direction: 'NW' }, { u: 0, v: 1, kind: 'redirect', direction: 'NE' },
      { u: 10, v: 10, kind: 'normal' },
    ],
    stacks: [{ u: 0, v: 0, height: 1 }, { u: 10, v: 10, height: 1 }], totalTiles: 2,
    cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
  };
  const parsed = validateLevel(raw);
  assert.ok(parsed.ok);
  const state = createInitialState(parsed.value);
  const result = simulateMove(parsed.value, state, { u: 0, v: 0 });
  assert.equal(result.accepted, false);
  if (!result.accepted) assert.equal(result.reason, 'cycle');
  assert.equal(result.nextState, state);
});

test('a path beyond the emergency bound is rejected, while exactly 4096 steps may stop at the edge', () => {
  const makeLongLevel = end => {
    const cells = Array.from({ length: end + 1 }, (_, u) => ({ u, v: 0, kind: 'normal' }));
    cells.push({ u: 5000, v: 0, kind: 'normal' });
    return validateLevel({
      schemaVersion: 1, id: `long-${end}`, title: 'Long route', cells,
      stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 5000, v: 0, height: 1 }], totalTiles: 2,
      cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
    });
  };
  const exact = makeLongLevel(4096);
  assert.ok(exact.ok);
  const done = simulateMove(exact.value, createInitialState(exact.value), { u: 0, v: 0 });
  assert.equal(done.accepted, true);
  if (done.accepted) assert.equal(done.steps.length, 4096);
  const over = makeLongLevel(4097);
  assert.ok(over.ok);
  const rejected = simulateMove(over.value, createInitialState(over.value), { u: 0, v: 0 });
  assert.equal(rejected.accepted, false);
  if (!rejected.accepted) assert.equal(rejected.reason, 'step-limit');
});
