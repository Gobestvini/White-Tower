import { DIRECTION_VECTORS, type Direction } from './directions.js';
import type { Cell, GameState, Level, Stack } from './model.js';

export type MoveStep = Readonly<{
  from: Readonly<{ u: number; v: number }>;
  to: Readonly<{ u: number; v: number }>;
  direction: Direction;
  movingHeightBefore: number;
  movingHeightAfter: number;
  absorbed: boolean;
  counter: number;
}>;
export type MoveEvent = Readonly<
  | { type: 'move'; stepIndex: number; at: Readonly<{ u: number; v: number }> }
  | { type: 'merge'; stepIndex: number; at: Readonly<{ u: number; v: number }>; absorbedHeight: number; height: number; counter: number }
  | { type: 'turn'; stepIndex: number; at: Readonly<{ u: number; v: number }>; direction: Direction }
  | { type: 'stop'; stepIndex: number; at: Readonly<{ u: number; v: number }>; reason: 'edge' }
>;
export type MoveResult = Readonly<
  | { accepted: true; nextState: GameState; steps: readonly MoveStep[]; events: readonly MoveEvent[]; won: boolean }
  | { accepted: false; reason: 'inactive' | 'blocked' | 'cycle' | 'step-limit'; nextState: GameState; steps: readonly []; events: readonly []; won: false }
>;

const key = (u: number, v: number) => `${u},${v}`;
const MAX_ROUTE_STEPS = 4096;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};
const maxCounter = (stacks: readonly Stack[]) => {
  const highest = Math.max(0, ...stacks.map(stack => stack.height));
  return highest < 2 ? 0 : highest;
};

function routeKey(u: number, v: number, direction: Direction, height: number, others: readonly Stack[]): string {
  const sorted = [...others].sort((a, b) => a.u - b.u || a.v - b.v);
  return JSON.stringify([u, v, direction, height, sorted.map(stack => [stack.u, stack.v, stack.height, stack.launchDirection ?? null])]);
}

function reject(state: GameState, reason: 'inactive' | 'blocked' | 'cycle' | 'step-limit'): MoveResult {
  return freeze({ accepted: false as const, reason, nextState: state, steps: [] as const, events: [] as const, won: false as const });
}

export function simulateMove(level: Level, state: GameState, start: Readonly<{ u: number; v: number }>): MoveResult {
  const startIndex = state.stacks.findIndex(stack => stack.u === start.u && stack.v === start.v);
  if (startIndex < 0) return reject(state, 'inactive');

  const active = state.stacks[startIndex];
  if (!active) return reject(state, 'inactive');
  const cells = new Map<string, Cell>(level.cells.map(cell => [key(cell.u, cell.v), cell]));
  const floorAtStart = cells.get(key(start.u, start.v));
  let direction = floorAtStart?.kind === 'redirect' ? floorAtStart.direction : active.launchDirection;
  if (!direction) return reject(state, 'inactive');

  const others = state.stacks.filter((_, index) => index !== startIndex).map(stack => ({ ...stack }));
  let u = active.u;
  let v = active.v;
  let height = active.height;
  const steps: MoveStep[] = [];
  const events: MoveEvent[] = [];
  const seen = new Set<string>();

  for (let iteration = 0; iteration <= MAX_ROUTE_STEPS; iteration++) {
    const signature = routeKey(u, v, direction, height, others);
    if (seen.has(signature)) return reject(state, 'cycle');
    seen.add(signature);

    const vector = DIRECTION_VECTORS[direction];
    const nextU = u + vector.u;
    const nextV = v + vector.v;
    const destination = cells.get(key(nextU, nextV));
    if (!destination || destination.kind === 'blocked') {
      if (steps.length === 0) return reject(state, 'blocked');
      events.push({ type: 'stop', stepIndex: steps.length, at: { u, v }, reason: 'edge' });
      break;
    }
    if (steps.length >= MAX_ROUTE_STEPS) return reject(state, 'step-limit');

    const from = { u, v };
    const to = { u: nextU, v: nextV };
    const targetIndex = others.findIndex(stack => stack.u === nextU && stack.v === nextV);
    const movingHeightBefore = height;
    let absorbed = false;
    if (targetIndex >= 0) {
      const target = others[targetIndex];
      if (target) {
        height += target.height;
        others.splice(targetIndex, 1);
        absorbed = true;
      }
    }
    u = nextU;
    v = nextV;
    const movingHeightAfter = height;
    const counter = maxCounter([...others, { ...active, u, v, height }]);
    steps.push({ from, to, direction, movingHeightBefore, movingHeightAfter, absorbed, counter });
    events.push({ type: 'move', stepIndex: steps.length - 1, at: to });
    if (absorbed) events.push({ type: 'merge', stepIndex: steps.length - 1, at: to, absorbedHeight: movingHeightAfter - movingHeightBefore, height, counter });

    if (destination.kind === 'redirect' && destination.direction) {
      direction = destination.direction;
      events.push({ type: 'turn', stepIndex: steps.length - 1, at: to, direction });
    }
  }

  const finalStacks = [...others, { id: active.id, u, v, height }];
  const nextState = freeze({ levelId: state.levelId, stacks: finalStacks, moveCount: state.moveCount + 1 });
  const won = nextState.stacks.length === 1 && nextState.stacks[0]?.height === level.totalTiles;
  return freeze({ accepted: true as const, nextState, steps, events, won });
}

