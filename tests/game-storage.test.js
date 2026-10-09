import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState } from '../src/game/model.ts';
import { validateLevel } from '../src/game/level-schema.js';
import { createGameController } from '../src/game/controller.ts';
import { createStore } from '../src/storage/store.ts';
import { createGameSave, migrateGameSave, validateGameSave } from '../src/storage/save-schema.ts';

const examples = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels;
const levelResult = validateLevel(examples[0]);
assert.ok(levelResult.ok);
const level = levelResult.value;
const catalog = { schemaVersion: 1, contentVersion: 'test-v1', levels: [{ id: level.id, path: '/level.json', sha256: 'a'.repeat(64) }] };

test('save validation accepts a stable game and rejects changed content, bad arrows and oversized history', () => {
  const save = createGameSave({ contentVersion: catalog.contentVersion, levelChecksum: catalog.levels[0].sha256, selectedLevelId: level.id, unlockedLevel: 1, completedLevelIds: [], settings: { sound: false, reducedMotion: true }, committedState: createInitialState(level), history: [] });
  const levels = new Map([[level.id, level]]);
  const restored = validateGameSave(save, catalog, levels);
  assert.equal(restored.ok, true);
  if (restored.ok) assert.deepEqual(restored.value.settings, { sound: false, reducedMotion: true });
  assert.equal(validateGameSave({ ...save, levelChecksum: 'b'.repeat(64) }, catalog, levels).ok, false);
  const badArrow = structuredClone(save);
  badArrow.committedState.stacks[0].launchDirection = 'sideways';
  assert.equal(validateGameSave(badArrow, catalog, levels).ok, false);
  assert.equal(validateGameSave({ ...save, history: Array.from({ length: 51 }, () => save.committedState) }, catalog, levels).ok, false);
});

test('save migration keeps an unchanged reference-level attempt across the 1.0 campaign extension', () => {
  const oldCatalog = { schemaVersion: 1, contentVersion: '1.0.0', levels: [{ id: level.id, path: '/level.json', sha256: 'a'.repeat(64) }] };
  const newCatalog = { ...oldCatalog, contentVersion: '1.1.0' };
  const oldSave = createGameSave({ contentVersion: oldCatalog.contentVersion, levelChecksum: oldCatalog.levels[0].sha256, selectedLevelId: level.id, unlockedLevel: 1, completedLevelIds: [], settings: {}, committedState: createInitialState(level), history: [] });
  const migrated = migrateGameSave(oldSave, newCatalog);
  assert.equal(migrated.contentVersion, '1.1.0');
  assert.equal(validateGameSave(migrated, newCatalog, new Map([[level.id, level]])).ok, true);
  assert.equal(migrateGameSave({ ...oldSave, levelChecksum: 'b'.repeat(64) }, newCatalog).contentVersion, '1.0.0');
});

test('store falls through denied adapters and keeps gameplay writes available in memory', async () => {
  const store = createStore({ adapters: [() => { throw new Error('SecurityError: denied'); }] });
  assert.equal(await store.ready, 'memory');
  assert.equal(store.memoryOnly(), true);
  await store.write({ committed: 1 });
  assert.deepEqual(await store.read(), { committed: 1 });
  assert.match(store.unavailableReason(), /denied/);
});

test('store falls back to memory after quota failure without rejecting a committed move', async () => {
  const adapter = { mode: 'localStorage', async read() { return undefined; }, async write() { throw new Error('QuotaExceededError'); } };
  const store = createStore({ adapters: [() => adapter] });
  await store.ready;
  await store.write({ moveCount: 1 });
  assert.equal(store.memoryOnly(), true);
  assert.deepEqual(await store.read(), { moveCount: 1 });
});

test('a write failure in IndexedDB retries the next durable adapter before using memory', async () => {
  let durableValue;
  const store = createStore({ adapters: [
    () => ({ mode: 'indexeddb', async read() { return undefined; }, async write() { throw new Error('blocked database'); } }),
    () => ({ mode: 'localStorage', async read() { return durableValue; }, async write(value) { durableValue = value; } }),
  ] });
  await store.ready;
  await store.write({ moveCount: 3 });
  assert.equal(store.mode(), 'localStorage');
  assert.deepEqual(durableValue, { moveCount: 3 });
  assert.deepEqual(await store.read(), { moveCount: 3 });
});

test('controller keeps only the latest 50 restored Undo snapshots without changing their values', () => {
  const controller = createGameController();
  controller.loadLevel(level);
  const original = createInitialState(level);
  const expected = JSON.stringify(original);
  const restored = controller.restoreAttempt(original, Array.from({ length: 55 }, () => original));
  assert.equal(restored.canUndo, true);
  assert.equal(controller.historySnapshot().length, 50);
  assert.equal(JSON.stringify(original), expected);
  assert.equal(original.moveCount, 0);
});
