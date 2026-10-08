import type { GameState, Level } from './model.js';
import { isWon, stateKey } from './model.js';
import { simulateMove } from './simulator.js';

export type SolveMove = Readonly<{ u: number; v: number }>;
export type SolveOptions = Readonly<{
  requestId: string;
  generationId?: number;
  budgetMs: number;
  maxStates?: number;
  isCancelled?: () => boolean;
}>;
export type SolveResult = Readonly<
  | { status: 'solved'; requestId: string; generationId: number; path: readonly SolveMove[]; explored: number; elapsedMs: number; shortest: true; matchesPar: boolean }
  | { status: 'unsolvable'; requestId: string; generationId: number; explored: number; elapsedMs: number }
  | { status: 'timeout' | 'cancelled'; requestId: string; generationId: number; explored: number; elapsedMs: number }
  | { status: 'error'; requestId: string; generationId: number; explored: number; elapsedMs: number; message: string }
>;

type Parent = { previousKey: string; move: SolveMove };
const clock = () => performance.now();

function reconstruct(goalKey: string, parents: Map<string, Parent>): SolveMove[] {
  const path: SolveMove[] = [];
  let cursor = goalKey;
  let parent = parents.get(cursor);
  while (parent) {
    path.push(parent.move);
    cursor = parent.previousKey;
    parent = parents.get(cursor);
  }
  return path.reverse();
}

export async function solve(level: Level, initial: GameState, options: SolveOptions): Promise<SolveResult> {
  const requestId = options.requestId;
  const generationId = options.generationId ?? 0;
  const started = clock();
  let explored = 0;
  const result = (status: SolveResult['status'], extras: Record<string, unknown> = {}): SolveResult => ({
    status, requestId, generationId, explored, elapsedMs: Math.max(0, clock() - started), ...extras,
  }) as SolveResult;
  if (!requestId || !Number.isFinite(options.budgetMs) || options.budgetMs < 0) return result('error', { message: 'Invalid request ID or time budget.' });
  const budgetMs = options.budgetMs;
  const maxStates = Math.max(1, Math.floor(options.maxStates ?? 100_000));
  if (options.isCancelled?.()) return result('cancelled');
  if (budgetMs === 0) return result('timeout');
  if (isWon(initial)) return result('solved', { path: [], shortest: true, matchesPar: level.parMoves === 0 });

  const cells = new Map(level.cells.map(cell => [`${cell.u},${cell.v}`, cell]));
  const canLaunch = (state: GameState, stack: GameState['stacks'][number]) =>
    Boolean(stack.launchDirection || cells.get(`${stack.u},${stack.v}`)?.kind === 'redirect');
  const initialKey = stateKey(initial);
  const states = new Map<string, GameState>([[initialKey, initial]]);
  const parents = new Map<string, Parent>();
  const queue: string[] = [initialKey];
  let head = 0;
  let sinceYield = 0;

  try {
    while (head < queue.length) {
      if (options.isCancelled?.()) return result('cancelled');
      if (clock() - started >= budgetMs) return result('timeout');
      const currentKey = queue[head++];
      if (!currentKey) continue;
      const state = states.get(currentKey);
      if (!state) continue;
      explored++;
      for (const stack of state.stacks) {
        if (!canLaunch(state, stack)) continue;
        if (clock() - started >= budgetMs) return result('timeout');
        const move = { u: stack.u, v: stack.v };
        const moved = simulateMove(level, state, move);
        if (!moved.accepted) continue;
        const nextKey = stateKey(moved.nextState);
        if (states.has(nextKey)) continue;
        if (states.size >= maxStates) return result('timeout');
        states.set(nextKey, moved.nextState);
        parents.set(nextKey, { previousKey: currentKey, move });
        if (moved.won || isWon(moved.nextState)) {
          const path = reconstruct(nextKey, parents);
          const verified = replaySolution(level, initial, path);
          if (!verified) return result('error', { message: 'Search produced a path that failed replay verification.' });
          return result('solved', { path, shortest: true, matchesPar: path.length === level.parMoves });
        }
        queue.push(nextKey);
        if (++sinceYield >= 64) {
          sinceYield = 0;
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          if (options.isCancelled?.()) return result('cancelled');
          if (clock() - started >= budgetMs) return result('timeout');
        }
      }
    }
    return result('unsolvable');
  } catch (error) {
    return result('error', { message: error instanceof Error ? error.message : String(error) });
  }
}

export function replaySolution(level: Level, initial: GameState, path: readonly SolveMove[]): GameState | undefined {
  let state = initial;
  for (const move of path) {
    const result = simulateMove(level, state, move);
    if (!result.accepted) return undefined;
    state = result.nextState;
  }
  return isWon(state) ? state : undefined;
}

export function validateKnownSolution(level: Level, initial: GameState, path: readonly SolveMove[]): Readonly<{ valid: boolean; finalState?: GameState; reason?: string }> {
  let state = initial;
  for (let index = 0; index < path.length; index++) {
    const move = path[index];
    if (!move) return { valid: false, reason: `Missing move ${index}.` };
    const result = simulateMove(level, state, move);
    if (!result.accepted) return { valid: false, reason: `Move ${index} is rejected (${result.reason}).` };
    state = result.nextState;
  }
  return isWon(state) ? { valid: true, finalState: state } : { valid: false, reason: 'The path does not finish in one stack.' };
}
