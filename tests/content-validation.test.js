import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('../tools/validate-levels.mjs', import.meta.url));
const template = {
  schemaVersion: 1, id: 'level-001', title: 'A line', cameraPreset: 'reference', tutorialKey: null,
  cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 1, v: 0, kind: 'normal' }],
  stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 1, v: 0, height: 1 }],
  totalTiles: 2, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
};

function fixture(t, level = template, checksumOverride) {
  const root = mkdtempSync(join(tmpdir(), 'white-tower-content-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'public', 'content', 'levels'); mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(level, null, 2) + '\n');
  writeFileSync(join(directory, '001.json'), bytes);
  const checksum = checksumOverride ?? createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(root, 'public', 'content', 'catalog.json'), JSON.stringify({ schemaVersion: 1, contentVersion: 'test', levels: [{ id: 'level-001', path: '/content/levels/001.json', sha256: checksum }] }));
  return root;
}
function run(root) { return execFileSync(process.execPath, ['--import', 'tsx', validator, '--root', root], { encoding: 'utf8' }); }

test('release validator accepts a checked level and replayable solution', t => {
  const output = run(fixture(t));
  assert.match(output, /Validated 1 ordered campaign levels/);
  assert.match(output, /known solutions passed/);
});

test('release validator rejects a broken level schema', t => {
  const duplicateCell = { ...template, cells: [...template.cells, template.cells[0]] };
  assert.throws(() => run(fixture(t, duplicateCell)), /schema error/);
});

test('release validator rejects a tampered content checksum', t => {
  assert.throws(() => run(fixture(t, template, '0'.repeat(64))), /checksum mismatch/);
});

test('release validator rejects a known solution that cannot be replayed', t => {
  const invalidSolution = { ...template, knownSolution: [{ u: 1, v: 0 }] };
  assert.throws(() => run(fixture(t, invalidSolution)), /known solution failed replay/);
});

test('release validator rejects level files missing from the campaign catalog', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'public', 'content', 'levels', '002.json'), readFileSync(join(root, 'public', 'content', 'levels', '001.json')));
  assert.throws(() => run(root), /Catalog\/file count differs/);
});
