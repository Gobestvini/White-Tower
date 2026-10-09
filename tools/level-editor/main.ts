import { createInitialState, validateLevel, type Level } from '../../src/game/level-schema.js';
import { isWon } from '../../src/game/model.js';
import { simulateMove } from '../../src/game/simulator.js';
import { solve, validateKnownSolution } from '../../src/game/solver.js';
import { createProjection, TILE_RADIUS, worldToScreen } from '../../src/render/projection.js';
import { DIRECTION_VECTORS, DIRECTIONS, type Direction } from '../../src/game/directions.js';

type Tool = 'cell' | 'redirect' | 'stack' | 'arrow' | 'erase';
type Draft = {
  schemaVersion: 1; id: string; title: string;
  cells: { u: number; v: number; kind: 'normal' | 'redirect' | 'blocked'; direction?: Direction }[];
  stacks: { u: number; v: number; height: number; launchDirection?: Direction }[];
  totalTiles: number; cameraPreset: string; tutorialKey: string | null; parMoves: number;
  knownSolution: { u: number; v: number }[];
};

const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing editor element: ${id}`);
  return element as T;
};
const canvas = $('board') as HTMLCanvasElement;
const context = canvas.getContext('2d')!;
const status = $('status') as HTMLOutputElement;
const jsonArea = $('json') as HTMLTextAreaElement;
const directionInput = $('direction') as HTMLSelectElement;
const directions = DIRECTIONS as Direction[];
let tool: Tool = 'cell';
let selected: { u: number; v: number } | undefined;
let history: string[] = [];
let draft: Draft = {
  schemaVersion: 1, id: 'editor-draft', title: 'Turning Path',
  cells: [{ u: 0, v: 0, kind: 'normal' }, { u: 1, v: 0, kind: 'normal' }, { u: 2, v: 0, kind: 'normal' }],
  stacks: [{ u: 0, v: 0, height: 1, launchDirection: 'SE' }, { u: 1, v: 0, height: 1 }, { u: 2, v: 0, height: 1 }],
  totalTiles: 3, cameraPreset: 'reference', tutorialKey: null, parMoves: 1, knownSolution: [{ u: 0, v: 0 }],
};

function refreshDerived(): void { draft.totalTiles = draft.stacks.reduce((sum, stack) => sum + stack.height, 0); }
function level(): Level {
  refreshDerived();
  const result = validateLevel(draft);
  if (!result.ok) throw new Error(result.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '));
  return result.value;
}
function projection() { return createProjection(level(), Math.max(1, draft.totalTiles)); }
function snapshot(): void { history.push(JSON.stringify(draft)); if (history.length > 100) history.shift(); }
function showStatus(message: string, error = false): void { status.value = message; status.textContent = message; status.style.color = error ? '#a32929' : ''; }
function syncJson(): void {
  ($('id') as HTMLInputElement).value = draft.id; ($('title') as HTMLInputElement).value = draft.title; ($('par') as HTMLInputElement).value = String(draft.parMoves);
  ($('camera') as HTMLSelectElement).value = draft.cameraPreset; $('count').textContent = String(draft.totalTiles);
  jsonArea.value = JSON.stringify(draft, null, 2);
}
function diamond(x: number, y: number, radius: number, color: string): void {
  context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x + radius, y); context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath(); context.fillStyle = color; context.fill();
}
function paint(): void {
  const view = projection();
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#60c0fe'; context.fillRect(0, 0, canvas.width, canvas.height);
  for (const cell of draft.cells) {
    const point = worldToScreen(cell.u, cell.v, 0, view);
    diamond(point.x, point.y, TILE_RADIUS * view.scale, cell.kind === 'blocked' ? '#3b6276' : '#ffd72e');
    if (cell.kind === 'redirect') {
      const vector = DIRECTION_VECTORS[cell.direction!];
      const dx = (vector.u - vector.v) * 17; const dy = -(vector.u + vector.v) * 17;
      context.strokeStyle = '#4b782b'; context.lineWidth = 5; context.beginPath(); context.moveTo(point.x - dx / 2, point.y - dy / 2); context.lineTo(point.x + dx / 2, point.y + dy / 2); context.stroke();
    }
  }
  for (const stack of draft.stacks) {
    const point = worldToScreen(stack.u, stack.v, 0, view);
    diamond(point.x, point.y - 2, TILE_RADIUS * view.scale - 4, '#fafafa');
    if (stack.launchDirection) {
      const vector = DIRECTION_VECTORS[stack.launchDirection];
      const dx = (vector.u - vector.v) * 21; const dy = -(vector.u + vector.v) * 21;
      context.strokeStyle = '#ff8f16'; context.lineWidth = 7; context.lineCap = 'round'; context.beginPath(); context.moveTo(point.x - dx / 2, point.y + dy / 2); context.lineTo(point.x + dx / 2, point.y - dy / 2); context.stroke();
    }
  }
  if (selected) {
    const point = worldToScreen(selected.u, selected.v, 0, view);
    context.strokeStyle = '#1b779d'; context.lineWidth = 4; context.beginPath(); context.moveTo(point.x, point.y - TILE_RADIUS * view.scale); context.lineTo(point.x + TILE_RADIUS * view.scale, point.y); context.lineTo(point.x, point.y + TILE_RADIUS * view.scale); context.lineTo(point.x - TILE_RADIUS * view.scale, point.y); context.closePath(); context.stroke();
  }
}
function editAt(position: { u: number; v: number }): void {
  selected = position;
  ($('coord-u') as HTMLInputElement).value = String(position.u); ($('coord-v') as HTMLInputElement).value = String(position.v);
  const cellIndex = draft.cells.findIndex(cell => cell.u === position.u && cell.v === position.v);
  const stackIndex = draft.stacks.findIndex(stack => stack.u === position.u && stack.v === position.v);
  const direction = directionInput.value as Direction;
  if (tool === 'erase') {
    if (stackIndex >= 0) draft.stacks.splice(stackIndex, 1);
    if (cellIndex >= 0) draft.cells.splice(cellIndex, 1);
  } else if (tool === 'cell' || tool === 'redirect') {
    const cell = { u: position.u, v: position.v, kind: tool === 'redirect' ? 'redirect' as const : 'normal' as const, ...(tool === 'redirect' ? { direction } : {}) };
    if (cellIndex >= 0) draft.cells[cellIndex] = cell; else draft.cells.push(cell);
  } else if (tool === 'stack') {
    if (cellIndex < 0) { showStatus('Place a floor cell before adding a tile.', true); return; }
    if (stackIndex >= 0) draft.stacks[stackIndex]!.height++;
    else draft.stacks.push({ u: position.u, v: position.v, height: 1, ...(draft.stacks.length === 0 ? { launchDirection: direction } : {}) });
  } else if (tool === 'arrow') {
    if (stackIndex >= 0) draft.stacks[stackIndex] = { ...draft.stacks[stackIndex]!, launchDirection: direction };
    else if (cellIndex >= 0) draft.cells[cellIndex] = { ...draft.cells[cellIndex]!, kind: 'redirect', direction };
    else { showStatus('Select a tile or floor cell first.', true); return; }
  }
  refreshDerived(); syncJson(); paint(); showStatus(`Edited ${position.u}, ${position.v}.`);
}
function applyToolAtCoordinate(): void {
  const u = Number(($('coord-u') as HTMLInputElement).value); const v = Number(($('coord-v') as HTMLInputElement).value);
  if (!Number.isSafeInteger(u) || !Number.isSafeInteger(v) || Math.abs(u) > 16 || Math.abs(v) > 16) { showStatus('Coordinates must be whole numbers from -16 to 16.', true); return; }
  snapshot(); editAt({ u, v });
}

canvas.addEventListener('click', event => {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
  const view = projection();
  let nearest: { u: number; v: number; distance: number } | undefined;
  for (let u = -8; u <= 8; u++) for (let v = -8; v <= 8; v++) {
    const point = worldToScreen(u, v, 0, view); const distance = Math.hypot(point.x - x, point.y - y);
    if (!nearest || distance < nearest.distance) nearest = { u, v, distance };
  }
  if (!nearest || nearest.distance > TILE_RADIUS * view.scale * 0.65) return;
  snapshot(); editAt(nearest);
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) button.addEventListener('click', () => {
  tool = button.dataset.tool as Tool;
  for (const candidate of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) candidate.setAttribute('aria-pressed', String(candidate === button));
});
($('camera') as HTMLSelectElement).addEventListener('change', event => { snapshot(); draft.cameraPreset = (event.currentTarget as HTMLSelectElement).value; syncJson(); paint(); });
$('rotate').addEventListener('click', () => {
  if (!selected) { showStatus('Select a tile or redirect cell first.', true); return; }
  const stack = draft.stacks.find(item => item.u === selected!.u && item.v === selected!.v);
  const cell = draft.cells.find(item => item.u === selected!.u && item.v === selected!.v);
  const current = stack?.launchDirection ?? cell?.direction ?? directionInput.value as Direction;
  const next = directions[(directions.indexOf(current) + 1) % directions.length]!; snapshot(); directionInput.value = next;
  if (stack) stack.launchDirection = next; else if (cell) { cell.kind = 'redirect'; cell.direction = next; }
  syncJson(); paint(); showStatus(`Direction rotated to ${next}.`);
});
$('apply-tool').addEventListener('click', applyToolAtCoordinate);
$('undo').addEventListener('click', () => { const previous = history.pop(); if (!previous) { showStatus('Nothing to undo.'); return; } draft = JSON.parse(previous) as Draft; selected = undefined; syncJson(); paint(); showStatus('Editor action undone.'); });
$('id').addEventListener('change', event => { snapshot(); draft.id = (event.currentTarget as HTMLInputElement).value; syncJson(); });
$('title').addEventListener('change', event => { snapshot(); draft.title = (event.currentTarget as HTMLInputElement).value; syncJson(); });
$('par').addEventListener('change', event => { snapshot(); draft.parMoves = Number((event.currentTarget as HTMLInputElement).value); syncJson(); });
$('refresh').addEventListener('click', syncJson);
$('import').addEventListener('click', () => {
  let raw: unknown;
  try { raw = JSON.parse(jsonArea.value); } catch (error) { showStatus(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`, true); return; }
  const result = validateLevel(raw);
  if (!result.ok) { showStatus(result.errors.map(issue => `${issue.path}: ${issue.message}`).join(' | '), true); return; }
  snapshot(); draft = JSON.parse(JSON.stringify(raw)) as Draft; selected = undefined; syncJson(); paint(); showStatus('Imported level validated; previous draft remains available with Undo.');
});
$('test').addEventListener('click', async () => {
  try {
    const candidate = level();
    const verified = validateKnownSolution(candidate, createInitialState(candidate), candidate.knownSolution);
    if (!verified.valid) { showStatus(`Known solution failed replay: ${verified.reason}`, true); return; }
    const result = await solve(candidate, createInitialState(candidate), { requestId: `editor-${Date.now()}`, budgetMs: 750 });
    if (result.status === 'solved') showStatus(`Playable. Shortest route: ${result.path.length} moves (${result.explored} states, ${result.elapsedMs.toFixed(1)} ms). parMoves stays ${candidate.parMoves} (estimate).`);
    else if (result.status === 'timeout') showStatus(`Known route replays; shortest-path search hit its limit after ${result.explored} states. parMoves is still an estimate.`);
    else showStatus(`No playable solution: ${result.status}${result.status === 'error' ? ` — ${result.message}` : ''}`, true);
    const first = simulateMove(candidate, createInitialState(candidate), candidate.knownSolution[0]!);
    if (!first.accepted || (candidate.knownSolution.length === 1 && !isWon(first.nextState))) showStatus('Known route does not finish the level.', true);
  } catch (error) { showStatus(error instanceof Error ? error.message : String(error), true); }
});
$('export').addEventListener('click', () => {
  try {
    const candidate = level();
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${candidate.id}.json`; link.click(); URL.revokeObjectURL(url); showStatus('Validated level JSON downloaded.');
  } catch (error) { showStatus(error instanceof Error ? error.message : String(error), true); }
});
$('screenshot').addEventListener('click', () => canvas.toBlob(blob => {
  if (!blob) { showStatus('Could not export board image.', true); return; }
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${draft.id}.png`; link.click(); URL.revokeObjectURL(url); showStatus('Board image downloaded.');
}));
syncJson(); paint();
