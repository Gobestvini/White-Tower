import type { Direction } from './directions.js';

export type CellKind = 'normal' | 'redirect' | 'blocked';
export type Cell = Readonly<{ u: number; v: number; kind: CellKind; direction?: Direction }>;
export type Stack = Readonly<{ id: string; u: number; v: number; height: number; launchDirection?: Direction }>;
export type Level = Readonly<{
  schemaVersion: 1; id: string; title: string; cells: readonly Cell[]; stacks: readonly Stack[];
  totalTiles: number; cameraPreset: string; tutorialKey: string | null; parMoves: number;
  knownSolution: readonly Readonly<{ u: number; v: number }>[];
}>;
export type GameState = Readonly<{ levelId: string; stacks: readonly Stack[]; moveCount: number }>;
export type LevelError = Readonly<{ path: string; message: string }>;
export type Result<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; errors: readonly LevelError[] }>;

const MAX_COORDINATE = 100_000;
const MAX_TILES = 100_000;
const DIRECTIONS = new Set(['SE', 'SW', 'NW', 'NE', 'E', 'W', 'N', 'S']);
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};
const coordKey = (u: number, v: number) => `${u},${v}`;
const stackId = (u: number, v: number) => `stack:${u},${v}`;

export function validateLevel(raw: unknown): Result<Level> {
  const errors: LevelError[] = [];
  const issue = (path: string, message: string) => errors.push({ path, message });
  if (!isRecord(raw)) return { ok: false, errors: [{ path: '$', message: 'Ожидался объект уровня.' }] };
  const allowedRoot = new Set(['schemaVersion', 'id', 'title', 'cells', 'stacks', 'totalTiles', 'cameraPreset', 'tutorialKey', 'parMoves', 'knownSolution']);
  for (const key of Object.keys(raw)) if (!allowedRoot.has(key)) issue(key, 'Неизвестное поле.');
  if (raw.schemaVersion !== 1) issue('schemaVersion', 'Поддерживается только версия схемы 1.');
  if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id)) issue('id', 'Нужен непустой идентификатор (до 80 символов: латиница, цифры, _ или -).');
  if (typeof raw.title !== 'string' || raw.title.length > 160) issue('title', 'Название должно быть строкой длиной до 160 символов.');
  if (typeof raw.cameraPreset !== 'string' || raw.cameraPreset.length === 0 || raw.cameraPreset.length > 80) issue('cameraPreset', 'Нужен идентификатор пресета камеры.');
  if (raw.tutorialKey !== null && (typeof raw.tutorialKey !== 'string' || raw.tutorialKey.length > 120)) issue('tutorialKey', 'Ожидался null или ключ до 120 символов.');
  if (!Number.isSafeInteger(raw.parMoves) || (raw.parMoves as number) < 0) issue('parMoves', 'Ожидалось неотрицательное целое число.');
  if (!Number.isSafeInteger(raw.totalTiles) || (raw.totalTiles as number) < 1 || (raw.totalTiles as number) > MAX_TILES) issue('totalTiles', `Ожидалось целое число от 1 до ${MAX_TILES}.`);

  const cells: Cell[] = [];
  const cellKeys = new Set<string>();
  if (!Array.isArray(raw.cells) || raw.cells.length === 0 || raw.cells.length > MAX_TILES) issue('cells', `Ожидался непустой массив до ${MAX_TILES} клеток.`);
  else raw.cells.forEach((entry, index) => {
    const path = `cells[${index}]`;
    if (!isRecord(entry)) { issue(path, 'Ожидался объект клетки.'); return; }
    for (const key of Object.keys(entry)) if (!['u', 'v', 'kind', 'direction'].includes(key)) issue(`${path}.${key}`, 'Неизвестное поле.');
    const { u, v, kind, direction } = entry;
    if (!Number.isSafeInteger(u) || Math.abs(u as number) > MAX_COORDINATE) issue(`${path}.u`, `Ожидалось целое число в пределах ±${MAX_COORDINATE}.`);
    if (!Number.isSafeInteger(v) || Math.abs(v as number) > MAX_COORDINATE) issue(`${path}.v`, `Ожидалось целое число в пределах ±${MAX_COORDINATE}.`);
    if (!['normal', 'redirect', 'blocked'].includes(String(kind))) issue(`${path}.kind`, 'Неизвестный вид клетки.');
    if (kind === 'redirect' && !DIRECTIONS.has(String(direction))) issue(`${path}.direction`, 'Для redirect требуется одно из восьми направлений.');
    if (kind !== 'redirect' && hasOwn(entry, 'direction')) issue(`${path}.direction`, 'Направление допустимо только для redirect.');
    if (Number.isSafeInteger(u) && Number.isSafeInteger(v) && Math.abs(u as number) <= MAX_COORDINATE && Math.abs(v as number) <= MAX_COORDINATE) {
      const key = coordKey(u as number, v as number);
      if (cellKeys.has(key)) issue(path, `Координата ${key} повторяется.`);
      cellKeys.add(key);
      if (['normal', 'redirect', 'blocked'].includes(String(kind)) && (kind !== 'redirect' || DIRECTIONS.has(String(direction))))
        cells.push({ u: u as number, v: v as number, kind: kind as CellKind, ...(kind === 'redirect' ? { direction: direction as Direction } : {}) });
    }
  });

  const stacks: Stack[] = [];
  const stackKeys = new Set<string>();
  let total = 0;
  let maxHeight = 0;
  if (!Array.isArray(raw.stacks) || raw.stacks.length === 0 || raw.stacks.length > MAX_TILES) issue('stacks', `Ожидался непустой массив до ${MAX_TILES} стопок.`);
  else raw.stacks.forEach((entry, index) => {
    const path = `stacks[${index}]`;
    if (!isRecord(entry)) { issue(path, 'Ожидался объект стопки.'); return; }
    for (const key of Object.keys(entry)) if (!['u', 'v', 'height', 'launchDirection'].includes(key)) issue(`${path}.${key}`, 'Неизвестное поле.');
    const { u, v, height, launchDirection } = entry;
    for (const [axis, value] of [['u', u], ['v', v]] as const)
      if (!Number.isSafeInteger(value) || Math.abs(value as number) > MAX_COORDINATE) issue(`${path}.${axis}`, `Ожидалось целое число в пределах ±${MAX_COORDINATE}.`);
    if (!Number.isSafeInteger(height) || (height as number) < 1 || (height as number) > MAX_TILES) issue(`${path}.height`, `Ожидалось целое число от 1 до ${MAX_TILES}.`);
    if (hasOwn(entry, 'launchDirection') && !DIRECTIONS.has(String(launchDirection))) issue(`${path}.launchDirection`, 'Неизвестное направление запуска.');
    if (Number.isSafeInteger(u) && Number.isSafeInteger(v) && Math.abs(u as number) <= MAX_COORDINATE && Math.abs(v as number) <= MAX_COORDINATE) {
      const key = coordKey(u as number, v as number);
      if (stackKeys.has(key)) issue(path, `Стопка на координате ${key} повторяется.`);
      stackKeys.add(key);
      const cell = cells.find(candidate => coordKey(candidate.u, candidate.v) === key);
      if (!cell) issue(path, 'Под стопкой нет клетки пола.');
      else if (cell.kind === 'blocked') issue(path, 'На заблокированной клетке нельзя размещать стопку.');
      if (Number.isSafeInteger(height) && (height as number) >= 1 && (height as number) <= MAX_TILES) {
        total += height as number;
        maxHeight = Math.max(maxHeight, height as number);
        stacks.push({ id: stackId(u as number, v as number), u: u as number, v: v as number, height: height as number,
          ...(DIRECTIONS.has(String(launchDirection)) ? { launchDirection: launchDirection as Direction } : {}) });
      }
    }
  });
  if (Number.isSafeInteger(raw.totalTiles) && total !== raw.totalTiles) issue('totalTiles', `Значение должно совпадать с суммой высот (${total}).`);
  if (maxHeight === total && total > 0) issue('stacks', 'Уровень уже решён в начальном состоянии.');

  const knownSolution: { u: number; v: number }[] = [];
  if (!Array.isArray(raw.knownSolution) || raw.knownSolution.length === 0 || raw.knownSolution.length > MAX_TILES) issue('knownSolution', 'Ожидался непустой список координат ходов.');
  else raw.knownSolution.forEach((entry, index) => {
    const path = `knownSolution[${index}]`;
    if (!isRecord(entry) || !Number.isSafeInteger(entry.u) || !Number.isSafeInteger(entry.v) || Math.abs(entry.u as number) > MAX_COORDINATE || Math.abs(entry.v as number) > MAX_COORDINATE) {
      issue(path, 'Ожидались целые координаты хода.'); return;
    }
    knownSolution.push({ u: entry.u as number, v: entry.v as number });
  });
  if (errors.length) return { ok: false, errors: freeze(errors) };
  const level = freeze({ schemaVersion: 1 as const, id: raw.id as string, title: raw.title as string, cells, stacks,
    totalTiles: raw.totalTiles as number, cameraPreset: raw.cameraPreset as string, tutorialKey: raw.tutorialKey as string | null,
    parMoves: raw.parMoves as number, knownSolution });
  return { ok: true, value: level };
}

export function createInitialState(level: Level): GameState {
  const stacks = level.stacks.map(stack => ({ ...stack }));
  return freeze({ levelId: level.id, stacks, moveCount: 0 });
}

export function deriveCounter(state: GameState): Readonly<{ current: number; total: number }> {
  const current = Math.max(0, ...state.stacks.map(stack => stack.height));
  return { current: current < 2 ? 0 : current, total: state.stacks.reduce((sum, stack) => sum + stack.height, 0) };
}

export function isWon(state: GameState): boolean {
  const total = state.stacks.reduce((sum, stack) => sum + stack.height, 0);
  return state.stacks.length === 1 && state.stacks[0]?.height === total;
}

export function stateKey(state: GameState): string {
  const stacks = [...state.stacks].sort((a, b) => a.u - b.u || a.v - b.v);
  return JSON.stringify(stacks.map(({ u, v, height, launchDirection }) => [u, v, height, launchDirection ?? null]));
}
