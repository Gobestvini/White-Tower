import type { GameState, Level } from '../game/model.js';
import type { ContentCatalog } from '../content/catalog.js';

export const SAVE_SCHEMA_VERSION = 1;
export type GameSave = Readonly<{
  schemaVersion: 1;
  contentVersion: string;
  levelChecksum: string;
  selectedLevelId: string;
  unlockedLevel: number;
  completedLevelIds: readonly string[];
  settings: Readonly<Record<string, unknown>>;
  committedState: GameState;
  history: readonly GameState[];
}>;
const directions = new Set(['SE', 'SW', 'NW', 'NE', 'E', 'W', 'N', 'S']);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function createGameSave(input: Omit<GameSave, 'schemaVersion'>): GameSave {
  return Object.freeze({ schemaVersion: SAVE_SCHEMA_VERSION, ...input });
}

function validState(raw: unknown, level: Level): raw is GameState {
  if (!record(raw) || raw.levelId !== level.id || !Number.isSafeInteger(raw.moveCount) || Number(raw.moveCount) < 0 || !Array.isArray(raw.stacks) || !raw.stacks.length) return false;
  let tiles = 0;
  const coords = new Set<string>();
  const cells = new Set(level.cells.map(cell => `${cell.u},${cell.v}`));
  for (const value of raw.stacks) {
    if (!record(value) || !Number.isSafeInteger(value.u) || !Number.isSafeInteger(value.v) || !Number.isSafeInteger(value.height) || Number(value.height) < 1 || !cells.has(`${value.u},${value.v}`)) return false;
    if (typeof value.id !== 'string' || !value.id || (value.launchDirection !== undefined && !directions.has(String(value.launchDirection)))) return false;
    const key = `${value.u},${value.v}`;
    if (coords.has(key)) return false;
    coords.add(key);
    tiles += Number(value.height);
  }
  return tiles === level.totalTiles;
}

export type SaveValidation = Readonly<{ ok: true; value: GameSave }> | Readonly<{ ok: false; reason: string }>;
export function validateGameSave(raw: unknown, catalog: ContentCatalog, levels: ReadonlyMap<string, Level>): SaveValidation {
  if (!record(raw)) return { ok: false, reason: 'Save must be an object.' };
  if (raw.schemaVersion !== SAVE_SCHEMA_VERSION) return { ok: false, reason: `Unsupported save schema: ${String(raw.schemaVersion)}.` };
  if (raw.contentVersion !== catalog.contentVersion || typeof raw.selectedLevelId !== 'string') return { ok: false, reason: 'Save content version or selected level is invalid.' };
  const entry = catalog.levels.find(item => item.id === raw.selectedLevelId);
  const level = levels.get(raw.selectedLevelId);
  if (!entry || !level || raw.levelChecksum !== entry.sha256) return { ok: false, reason: 'Saved level checksum does not match current content.' };
  if (!Number.isSafeInteger(raw.unlockedLevel) || Number(raw.unlockedLevel) < 1 || Number(raw.unlockedLevel) > catalog.levels.length + 1) return { ok: false, reason: 'Unlocked level is outside the catalog.' };
  if (!Array.isArray(raw.completedLevelIds) || raw.completedLevelIds.some(id => typeof id !== 'string' || !catalog.levels.some(item => item.id === id))) return { ok: false, reason: 'Completed levels contain unknown IDs.' };
  if (!record(raw.settings) || !validState(raw.committedState, level) || !Array.isArray(raw.history) || raw.history.length > 50 || raw.history.some(state => !validState(state, level))) return { ok: false, reason: 'Saved game state or undo history is invalid.' };
  return { ok: true, value: createGameSave({
    contentVersion: raw.contentVersion as string,
    levelChecksum: raw.levelChecksum as string,
    selectedLevelId: raw.selectedLevelId,
    unlockedLevel: Number(raw.unlockedLevel),
    completedLevelIds: Object.freeze([...new Set(raw.completedLevelIds as string[])]),
    settings: Object.freeze({ ...raw.settings }),
    committedState: raw.committedState,
    history: Object.freeze(raw.history.slice(-50) as GameState[]),
  }) };
}
