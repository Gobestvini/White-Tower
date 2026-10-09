import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState, validateLevel } from '../src/game/level-schema.ts';
import { isWon } from '../src/game/model.ts';
import { simulateMove } from '../src/game/simulator.ts';
import { solve, validateKnownSolution } from '../src/game/solver.ts';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex >= 0 ? resolve(process.argv[rootIndex + 1]) : resolve(fileURLToPath(new URL('../', import.meta.url)));
const contentRoot = join(root, 'public', 'content');
const catalog = JSON.parse(await readFile(join(contentRoot, 'catalog.json'), 'utf8'));
if (catalog?.schemaVersion !== 1 || typeof catalog.contentVersion !== 'string' || !Array.isArray(catalog.levels) || !catalog.levels.length) throw new Error('Content catalog is invalid or empty.');
const files = (await readdir(join(contentRoot, 'levels'))).filter(path => path.endsWith('.json')).sort();
if (files.length !== catalog.levels.length) throw new Error(`Catalog/file count differs: ${catalog.levels.length} entries, ${files.length} files.`);
const ids = new Set();
const solutions = [];
let cycleStarts = 0;
const searchDurations = [];

for (let index = 0; index < catalog.levels.length; index++) {
  const entry = catalog.levels[index];
  const number = String(index + 1).padStart(3, '0');
  const expectedPath = `/content/levels/${number}.json`;
  if (entry?.id !== `level-${number}` || entry.path !== expectedPath || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Catalog entry ${index + 1} is unordered or malformed.`);
  if (ids.has(entry.id) || basename(expectedPath) !== files[index]) throw new Error(`Duplicate ID or untracked level file at ${entry.id}.`);
  ids.add(entry.id);
  const bytes = await readFile(join(contentRoot, expectedPath.replace(/^\/content\//, '')));
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if (checksum !== entry.sha256) throw new Error(`${entry.id}: checksum mismatch.`);
  let raw;
  try { raw = JSON.parse(bytes.toString('utf8')); }
  catch (error) { throw new Error(`${entry.id}: malformed JSON (${error.message}).`); }
  const checked = validateLevel(raw);
  if (!checked.ok) throw new Error(`${entry.id}: schema error: ${checked.errors.map(issue => `${issue.path} ${issue.message}`).join('; ')}`);
  const level = checked.value;
  const initial = createInitialState(level);
  const replay = validateKnownSolution(level, initial, level.knownSolution);
  if (!replay.valid) throw new Error(`${entry.id}: known solution failed replay (${replay.reason}).`);

  for (const stack of initial.stacks) {
    const floor = level.cells.find(cell => cell.u === stack.u && cell.v === stack.v);
    if (!stack.launchDirection && floor?.kind !== 'redirect') continue;
    const attempted = simulateMove(level, initial, stack);
    if (!attempted.accepted && attempted.reason === 'cycle') cycleStarts++;
  }
  if (!isWon(replay.finalState)) throw new Error(`${entry.id}: known solution did not converge to one stack.`);
  const search = await solve(level, initial, { requestId: `release-${entry.id}`, budgetMs: 250, maxStates: 50_000 });
  searchDurations.push(search.elapsedMs);
  if (search.status === 'unsolvable') throw new Error(`${entry.id}: solver proved no playable solution.`);
  if (search.status === 'timeout') solutions.push(`${entry.id}: replay verified; shortest-search budget exhausted`);
  else if (search.status !== 'solved') throw new Error(`${entry.id}: solver returned ${search.status}.`);
  else if (search.path.length !== level.parMoves) solutions.push(`${entry.id}: parMoves=${level.parMoves} is an estimate; shortest=${search.path.length}`);
}

console.log(`Validated ${catalog.levels.length} ordered campaign levels (${catalog.contentVersion}); checksums and known solutions passed.`);
console.log(`Initial launch attempts rejected as cycles: ${cycleStarts}.`);
if (cycleStarts) throw new Error(`Release content contains ${cycleStarts} launch route(s) that cycle before reaching an edge.`);
console.log(`Optimal-search time: ${searchDurations.reduce((sum, value) => sum + value, 0).toFixed(1)} ms total; ${Math.max(0, ...searchDurations).toFixed(1)} ms maximum per level.`);
for (const note of solutions) console.log(`Note: ${note}.`);
