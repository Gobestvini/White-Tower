import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState } from '../src/game/level-schema.js';
import { replaySolution, validateKnownSolution } from '../src/game/solver.js';
import { ContentLoadError, loadCatalog, loadLevelAt, loadLevelById } from '../src/content/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fetcher = async url => {
  try { return new Response(readFileSync(`${root}public${url}`), { status: 200 }); }
  catch { return new Response('', { status: 404 }); }
};

test('catalog loads 120 ordered levels with verified checksums and solver-backed solutions', async () => {
  const catalog = await loadCatalog('/content/catalog.json', fetcher);
  assert.equal(catalog.contentVersion, '1.1.0');
  assert.equal(catalog.levels.length, 120);
  assert.deepEqual(catalog.levels.map(entry => entry.id), Array.from({ length: 120 }, (_, index) => `level-${String(index + 1).padStart(3, '0')}`));
  assert.deepEqual(catalog.levels.map(entry => entry.sha256.length), Array(120).fill(64));
  assert.deepEqual(catalog.levels.map(entry => entry.path), Array.from({ length: 120 }, (_, index) => `/content/levels/${String(index + 1).padStart(3, '0')}.json`));
  for (let index = 0; index < catalog.levels.length; index++) {
    const level = await loadLevelAt(catalog, index, fetcher);
    assert.ok(level.totalTiles >= 4 && level.totalTiles <= 36, level.id);
    const initial = createInitialState(level);
    assert.equal(validateKnownSolution(level, initial, level.knownSolution).valid, true, level.id);
    assert.ok(replaySolution(level, initial, level.knownSolution), level.id);
  }
});

test('catalog and level fetch report missing content and checksum corruption', async () => {
  await assert.rejects(loadCatalog('/content/missing.json', fetcher), error => error instanceof ContentLoadError && error.code === 'network');
  const catalog = await loadCatalog('/content/catalog.json', fetcher);
  await assert.rejects(loadLevelAt(catalog, 120, fetcher), error => error instanceof ContentLoadError && error.code === 'missing-level');
  const altered = { ...catalog, levels: catalog.levels.map((entry, index) => index === 0 ? { ...entry, sha256: '0'.repeat(64) } : entry) };
  await assert.rejects(loadLevelById(altered, 'level-001', fetcher), error => error instanceof ContentLoadError && error.code === 'checksum');
});

test('verified levels are cached by content version and abort signals reach network requests', async () => {
  const catalog = await loadCatalog('/content/catalog.json', fetcher);
  const entry = catalog.levels[0];
  let calls = 0;
  const uniqueCatalog = { ...catalog, contentVersion: `cache-test-${Date.now()}` };
  const countingFetch = async url => { calls++; return fetcher(url); };
  await loadLevelById(uniqueCatalog, entry.id, countingFetch);
  await loadLevelById(uniqueCatalog, entry.id, countingFetch);
  assert.equal(calls, 1);
  const controller = new AbortController();
  const abortingFetch = (_url, options) => new Promise((resolve, reject) => {
    assert.equal(options.signal, controller.signal);
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const request = loadLevelById({ ...catalog, contentVersion: `abort-test-${Date.now()}` }, entry.id, abortingFetch, controller.signal);
  controller.abort();
  await assert.rejects(request, error => error instanceof ContentLoadError && error.code === 'network');
});
