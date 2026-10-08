import { solve } from './solver.js';
import type { GameState, Level } from './model.js';
import type { SolveResult } from './solver.js';

type SolveRequest = Readonly<{
  type: 'solve'; requestId: string; generationId: number; budgetMs: number; level: Level; state: GameState;
}>;
type CancelRequest = Readonly<{ type: 'cancel'; requestId: string }>;
type WorkerMessage = SolveRequest | CancelRequest;
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerMessage>) => void): void;
  postMessage(message: SolveResult): void;
};

const scope = self as unknown as WorkerScope;
const cancelled = new Set<string>();

scope.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'cancel') {
    cancelled.add(message.requestId);
    return;
  }
  cancelled.delete(message.requestId);
  void solve(message.level, message.state, {
    requestId: message.requestId,
    generationId: message.generationId,
    budgetMs: message.budgetMs,
    isCancelled: () => cancelled.has(message.requestId),
  }).then(result => {
    cancelled.delete(message.requestId);
    scope.postMessage(result);
  }).catch(error => {
    cancelled.delete(message.requestId);
    scope.postMessage({ status: 'error', requestId: message.requestId, generationId: message.generationId,
      explored: 0, elapsedMs: 0, message: error instanceof Error ? error.message : String(error) });
  });
});
