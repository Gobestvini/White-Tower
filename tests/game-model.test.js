import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState, deriveCounter, isWon, stateKey, validateLevel } from '../src/game/level-schema.js';

const examplesPath = fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url));
const rawExamples = JSON.parse(readFileSync(examplesPath, 'utf8'));
const parsed = rawExamples.levels.map(validateLevel);

test('all four GDD example levels validate without modifying their source data', () => {
  assert.equal(parsed.length, 4);
  assert.ok(parsed.every(result => result.ok));
  assert.equal(rawExamples.levels[0].stacks[0].height, 1);
});

test('validation rejects duplicate cells, missing floor, bad directions and tile totals', () => {
  const source = structuredClone(rawExamples.levels[0]);
  source.cells.push({ ...source.cells[0] });
  source.stacks.push({ u: 8, v: 8, height: 1 });
  source.cells[0].kind = 'redirect';
  source.cells[0].direction = 'NORTHEAST';
  source.totalTiles = 9;
  const result = validateLevel(source);
  assert.equal(result.ok, false);
  if (!result.ok) {
    const messages = result.errors.map(error => error.message).join(' ');
    assert.match(messages, /повторяется/);
    assert.match(messages, /нет клетки пола/);
    assert.match(messages, /направлен/);
    assert.match(messages, /суммой высот/);
  }
});

test('validation rejects unsupported versions, invalid heights and solved starts', () => {
  const wrongVersion = structuredClone(rawExamples.levels[0]);
  wrongVersion.schemaVersion = 2;
  assert.equal(validateLevel(wrongVersion).ok, false);
  const wrongHeight = structuredClone(rawExamples.levels[0]);
  wrongHeight.stacks[0].height = 0;
  assert.equal(validateLevel(wrongHeight).ok, false);
  const solved = structuredClone(rawExamples.levels[0]);
  solved.stacks = [{ u: 0, v: 0, height: 4 }];
  assert.equal(validateLevel(solved).ok, false);
});

test('initial state is immutable and independent; counter and win rules are deterministic', () => {
  const level = parsed[0];
  assert.ok(level.ok);
  if (!level.ok) return;
  const first = createInitialState(level.value);
  const second = createInitialState(level.value);
  assert.notEqual(first.stacks, second.stacks);
  assert.equal(Object.isFrozen(first.stacks), true);
  assert.deepEqual(deriveCounter(first), { current: 0, total: 4 });
  assert.equal(isWon(first), false);
  const won = { ...first, stacks: [{ ...first.stacks[0], height: 4 }] };
  assert.deepEqual(deriveCounter(won), { current: 4, total: 4 });
  assert.equal(isWon(won), true);
});

test('state key ignores stack array order but includes launch direction', () => {
  const level = parsed[1];
  assert.ok(level.ok);
  if (!level.ok) return;
  const state = createInitialState(level.value);
  const reordered = { ...state, stacks: [...state.stacks].reverse() };
  assert.equal(stateKey(state), stateKey(reordered));
  const changed = { ...state, stacks: state.stacks.map((stack, index) => index === 0 ? { ...stack, launchDirection: 'SE' } : stack) };
  assert.notEqual(stateKey(state), stateKey(changed));
});
