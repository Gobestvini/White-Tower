import type { GameState, Level } from './model.js';
import type { SolveResult } from './solver.js';

type Request = Readonly<{ type: 'solve'; requestId: string; generationId: number; budgetMs: number; level: Level; state: GameState }>;
type WorkerMessage = Request | Readonly<{ type: 'cancel'; requestId: string }>;
type WorkerLike = {
  onmessage: ((event: MessageEvent<SolveResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerMessage): void;
  terminate(): void;
};
type Pending = { generationId: number; resolve: (result: SolveResult) => void };

const cancelled = (requestId: string, generationId: number): SolveResult => ({ status: 'cancelled', requestId, generationId, explored: 0, elapsedMs: 0 });

export function createSolverClient(createWorker: () => WorkerLike = () => new Worker(new URL('./solver-worker.ts', import.meta.url), { type: 'module' })) {
  let worker: WorkerLike | undefined;
  let generationId = 0;
  let disposed = false;
  const pending = new Map<string, Pending>();

  function resolveAll(error?: string) {
    for (const [requestId, entry] of pending) {
      entry.resolve(error
        ? { status: 'error', requestId, generationId: entry.generationId, explored: 0, elapsedMs: 0, message: error }
        : cancelled(requestId, entry.generationId));
    }
    pending.clear();
  }

  function ensureWorker(): WorkerLike {
    if (worker) return worker;
    worker = createWorker();
    worker.onmessage = event => {
      const result = event.data;
      const entry = pending.get(result.requestId);
      if (!entry) return;
      pending.delete(result.requestId);
      if (entry.generationId !== generationId || result.generationId !== generationId) entry.resolve(cancelled(result.requestId, entry.generationId));
      else entry.resolve(result);
    };
    worker.onerror = event => resolveAll(event.message || 'Solver worker failed.');
    return worker;
  }

  function solve(level: Level, state: GameState, options: Readonly<{ requestId: string; generationId: number; budgetMs: number }>): Promise<SolveResult> {
    if (disposed) return Promise.resolve(cancelled(options.requestId, options.generationId));
    if (!options.requestId || !Number.isFinite(options.budgetMs) || options.budgetMs < 0) return Promise.resolve({
      status: 'error', requestId: options.requestId, generationId: options.generationId, explored: 0, elapsedMs: 0, message: 'Invalid request options.',
    });
    if (options.generationId < generationId) return Promise.resolve(cancelled(options.requestId, options.generationId));
    if (options.generationId > generationId) invalidate(options.generationId);
    if (pending.has(options.requestId)) return Promise.resolve({
      status: 'error', requestId: options.requestId, generationId: options.generationId, explored: 0, elapsedMs: 0, message: 'Duplicate request ID.',
    });
    return new Promise(resolve => {
      pending.set(options.requestId, { generationId: options.generationId, resolve });
      try {
        ensureWorker().postMessage({ type: 'solve', requestId: options.requestId, generationId: options.generationId, budgetMs: options.budgetMs, level, state });
      } catch (error) {
        pending.delete(options.requestId);
        resolve({ status: 'error', requestId: options.requestId, generationId: options.generationId, explored: 0, elapsedMs: 0,
          message: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  function cancel(requestId: string): void {
    if (!pending.has(requestId) || !worker) return;
    try { worker.postMessage({ type: 'cancel', requestId }); } catch { /* disposal will resolve remaining requests */ }
  }

  function invalidate(nextGenerationId: number): void {
    if (disposed || nextGenerationId <= generationId) return;
    generationId = nextGenerationId;
    for (const [requestId, entry] of pending) {
      if (entry.generationId === generationId) continue;
      try { worker?.postMessage({ type: 'cancel', requestId }); } catch { /* stale result is still filtered */ }
      entry.resolve(cancelled(requestId, entry.generationId));
      pending.delete(requestId);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    resolveAll();
    worker?.terminate();
    worker = undefined;
  }

  return Object.freeze({ solve, cancel, invalidate, dispose });
}
