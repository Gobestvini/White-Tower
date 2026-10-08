import { createInitialState, type GameState, type Level } from './model.js';
import { isWon } from './model.js';
import { simulateMove, type MoveResult } from './simulator.js';

export type GamePhase = 'Loading' | 'Idle' | 'Animating' | 'Won' | 'Menu' | 'LoadError' | 'Unsupported';
export type GameSnapshot = Readonly<{
  phase: GamePhase;
  level?: Level;
  committedState?: GameState;
  displayedState?: GameState;
  animation?: Extract<MoveResult, { accepted: true }>;
  generationId: number;
  attemptId: number;
  canUndo: boolean;
  completedLevelIds: readonly string[];
  error?: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createGameController() {
  let phase: GamePhase = 'Loading';
  let level: Level | undefined;
  let initialState: GameState | undefined;
  let committedState: GameState | undefined;
  let displayedState: GameState | undefined;
  let animation: Extract<MoveResult, { accepted: true }> | undefined;
  let generationId = 0;
  let attemptId = 0;
  let error: string | undefined;
  let menuReturn: 'Idle' | 'Won' = 'Idle';
  let disposed = false;
  const history: GameState[] = [];
  const completed = new Set<string>();

  function snapshot(): GameSnapshot {
    return deepFreeze({
      phase,
      ...(level ? { level } : {}),
      ...(committedState ? { committedState } : {}),
      ...(displayedState ? { displayedState } : {}),
      ...(animation ? { animation } : {}),
      generationId,
      attemptId,
      canUndo: history.length > 0 && (phase === 'Idle' || phase === 'Won'),
      completedLevelIds: [...completed].sort(),
      ...(error ? { error } : {}),
    });
  }

  function loadLevel(nextLevel: Level): GameSnapshot {
    if (disposed) return snapshot();
    generationId++;
    attemptId++;
    level = nextLevel;
    initialState = createInitialState(nextLevel);
    committedState = initialState;
    displayedState = initialState;
    animation = undefined;
    history.length = 0;
    error = undefined;
    phase = isWon(initialState) ? 'Won' : 'Idle';
    if (phase === 'Won') completed.add(nextLevel.id);
    return snapshot();
  }

  function restoreAttempt(state: GameState, previousStates: readonly GameState[]): GameSnapshot {
    if (disposed || !level || state.levelId !== level.id || (phase !== 'Idle' && phase !== 'Won')) return snapshot();
    const validHistory = previousStates.slice(-50);
    generationId++;
    attemptId++;
    committedState = deepFreeze(state);
    displayedState = committedState;
    history.splice(0, history.length, ...validHistory.map(item => deepFreeze(item)));
    animation = undefined;
    phase = isWon(committedState) ? 'Won' : 'Idle';
    if (phase === 'Won') completed.add(level.id);
    return snapshot();
  }

  function restoreCompleted(ids: readonly string[]): GameSnapshot {
    if (disposed) return snapshot();
    completed.clear();
    for (const id of ids) completed.add(id);
    if (level && phase === 'Won') completed.add(level.id);
    return snapshot();
  }

  function historySnapshot(): readonly GameState[] { return Object.freeze(history.slice(-50)); }

  function launch(start: Readonly<{ u: number; v: number }>): GameSnapshot {
    if (disposed || phase !== 'Idle' || !level || !committedState || !displayedState) return snapshot();
    const result = simulateMove(level, committedState, start);
    if (!result.accepted) return snapshot();
    history.push(committedState);
    committedState = result.nextState;
    animation = result;
    generationId++;
    phase = 'Animating';
    return snapshot();
  }

  function finishAnimation(expectedGenerationId: number): GameSnapshot {
    if (disposed || phase !== 'Animating' || expectedGenerationId !== generationId || !committedState) return snapshot();
    displayedState = committedState;
    animation = undefined;
    if (level && isWon(committedState)) {
      phase = 'Won';
      completed.add(level.id);
    } else phase = 'Idle';
    return snapshot();
  }

  function undo(): GameSnapshot {
    if (disposed || (phase !== 'Idle' && phase !== 'Won') || history.length === 0) return snapshot();
    const previous = history.pop();
    if (!previous) return snapshot();
    generationId++;
    committedState = previous;
    displayedState = previous;
    animation = undefined;
    phase = 'Idle';
    return snapshot();
  }

  function restart(): GameSnapshot {
    if (disposed || !initialState || !level || (phase !== 'Idle' && phase !== 'Won')) return snapshot();
    generationId++;
    attemptId++;
    committedState = createInitialState(level);
    displayedState = committedState;
    history.length = 0;
    animation = undefined;
    phase = isWon(committedState) ? 'Won' : 'Idle';
    return snapshot();
  }

  function openMenu(): GameSnapshot {
    if (disposed || (phase !== 'Idle' && phase !== 'Won')) return snapshot();
    menuReturn = phase;
    phase = 'Menu';
    return snapshot();
  }

  function closeMenu(): GameSnapshot {
    if (disposed || phase !== 'Menu') return snapshot();
    phase = menuReturn;
    return snapshot();
  }

  function setLoadError(message: string): GameSnapshot {
    if (disposed) return snapshot();
    generationId++;
    animation = undefined;
    error = message;
    phase = 'LoadError';
    return snapshot();
  }

  function setUnsupported(message = 'WebGL недоступен.'): GameSnapshot {
    if (disposed) return snapshot();
    generationId++;
    animation = undefined;
    error = message;
    phase = 'Unsupported';
    return snapshot();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generationId++;
    animation = undefined;
    history.length = 0;
  }

  return Object.freeze({ snapshot, loadLevel, restoreAttempt, restoreCompleted, historySnapshot, launch, finishAnimation, undo, restart, openMenu, closeMenu, setLoadError, setUnsupported, dispose });
}
