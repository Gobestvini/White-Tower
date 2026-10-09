import type { GameState, Level } from './model.js';
import type { SolveResult } from './solver.js';
import type { createSolverClient } from './solver-client.js';

export type HintView = Readonly<
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'move'; move: Readonly<{ u: number; v: number }> }
  | { kind: 'undo-proven' }
  | { kind: 'undo-suggestion' }
  | { kind: 'deadlock' }
  | { kind: 'timeout' }
  | { kind: 'error' }
>;
type Solver = Pick<ReturnType<typeof createSolverClient>, 'solve' | 'cancel' | 'invalidate'>;
const IDLE: HintView = Object.freeze({ kind: 'idle' });

export function createHintService(solver: Solver, update: (view: HintView) => void) {
  let generation = 0;
  let sequence = 0;
  let activeRequest = '';
  let spinnerTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function cancel(): void {
    if (disposed) return;
    if (spinnerTimer !== undefined) clearTimeout(spinnerTimer);
    spinnerTimer = undefined;
    if (activeRequest) solver.cancel(activeRequest);
    activeRequest = '';
    generation++;
    solver.invalidate(generation);
    update(IDLE);
  }

  async function request(level: Level, state: GameState, history: readonly GameState[]): Promise<void> {
    if (disposed) return;
    cancel();
    const requestGeneration = generation;
    const started = performance.now();
    const requestId = `hint-${++sequence}`;
    activeRequest = requestId;
    update({ kind: 'idle' });
    spinnerTimer = setTimeout(() => {
      if (!disposed && generation === requestGeneration && activeRequest) update({ kind: 'searching' });
    }, 300);

    const isCurrent = () => !disposed && generation === requestGeneration;
    try {
      const currentResult = await solver.solve(level, state, { requestId, generationId: requestGeneration, budgetMs: 2000 });
      if (!isCurrent()) return;
      if (currentResult.status === 'solved') {
        if (spinnerTimer !== undefined) clearTimeout(spinnerTimer);
        spinnerTimer = undefined;
        const move = currentResult.path[0];
        update(move ? { kind: 'move', move } : IDLE);
        activeRequest = '';
        return;
      }
      if (currentResult.status === 'unsolvable') {
        const previous = history.at(-1);
        const remaining = Math.max(0, 2000 - (performance.now() - started));
        if (!previous || remaining <= 0) {
          if (spinnerTimer !== undefined) clearTimeout(spinnerTimer);
          spinnerTimer = undefined; update({ kind: 'deadlock' }); activeRequest = ''; return;
        }
        if (spinnerTimer === undefined) update({ kind: 'searching' });
        const previousId = `hint-${sequence}-undo`;
        activeRequest = previousId;
        const previousResult = await solver.solve(level, previous, { requestId: previousId, generationId: requestGeneration, budgetMs: remaining });
        if (!isCurrent()) return;
        if (spinnerTimer !== undefined) clearTimeout(spinnerTimer);
        spinnerTimer = undefined;
        if (previousResult.status === 'solved') update({ kind: 'undo-proven' });
        else if (previousResult.status === 'unsolvable') update({ kind: 'deadlock' });
        else if (previousResult.status === 'timeout') update({ kind: 'undo-suggestion' });
        else update(previousResult.status === 'cancelled' ? IDLE : { kind: 'error' });
        activeRequest = '';
        return;
      }
      if (spinnerTimer !== undefined) clearTimeout(spinnerTimer);
      spinnerTimer = undefined;
      if (currentResult.status === 'timeout') update(history.length ? { kind: 'undo-suggestion' } : { kind: 'timeout' });
      else update(currentResult.status === 'cancelled' ? IDLE : { kind: 'error' });
      activeRequest = '';
    } catch {
      if (isCurrent()) { update({ kind: 'error' }); activeRequest = ''; }
    }
  }

  function dispose(): void { if (disposed) return; cancel(); disposed = true; }
  return Object.freeze({ request, cancel, dispose });
}
