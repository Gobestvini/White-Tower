import { DIRECTION_VECTORS, type Direction } from '../game/directions.js';
import type { Stack } from '../game/model.js';
import type { MoveEvent, MoveStep } from '../game/simulator.js';
import { MOVE_TIMINGS } from './timings.js';

export type PresentedStack = Stack & Readonly<{ tilt?: number; lift?: number; turnRotation?: number }>;
type Segment = Readonly<{
  kind: 'move' | 'turn' | 'stop'; duration: number; from: readonly PresentedStack[]; to: readonly PresentedStack[];
  stackId?: string; start?: Readonly<{ u: number; v: number }>; end?: Readonly<{ u: number; v: number }>;
  heightFrom?: number; heightTo?: number; direction?: Direction; absorbedId?: string;
}>;
export type AnimationSnapshot = Readonly<{ active: boolean; elapsedMs: number; durationMs: number; stacks: readonly PresentedStack[]; event?: string }>;
export type PresentationCue = 'merge' | 'settle' | 'turn';
type ScheduledCue = Readonly<{ atMs: number; cue: PresentationCue }>;

const ease = (value: number) => value * value * (3 - 2 * value);
function screenAngle(direction: Direction | undefined): number {
  if (!direction) return 0;
  const vector = DIRECTION_VECTORS[direction];
  return Math.atan2(-(vector.u + vector.v), vector.u - vector.v);
}

export function createAnimationPlayer(options: { onComplete?: (generationId: number) => void; onCue?: (cue: PresentationCue) => void } = {}) {
  let segments: Segment[] = [];
  let elapsedMs = 0;
  let durationMs = 0;
  let generationId = 0;
  let paused = false;
  let active = false;
  let disposed = false;
  let reducedMotion = false;
  let speed = 1;
  let baseStacks: readonly PresentedStack[] = [];
  let cues: readonly ScheduledCue[] = [];
  let cached: AnimationSnapshot = Object.freeze({ active: false, elapsedMs: 0, durationMs: 0, stacks: [] });

  function makeSnapshot(): AnimationSnapshot {
    if (!active || !segments.length) return Object.freeze({ active: false, elapsedMs, durationMs, stacks: baseStacks });
    let cursor = 0;
    for (const segment of segments) {
      const progress = Math.max(0, Math.min(1, (elapsedMs - cursor) / segment.duration));
      if (progress < 1) {
        if (segment.kind === 'stop' && segment.stackId) {
          const settle = reducedMotion ? 0 : Math.sin(progress * Math.PI * 2) * (1 - progress) * 0.11;
          const stacks = segment.from.map(stack => stack.id === segment.stackId ? { ...stack, tilt: settle } : stack);
          return Object.freeze({ active: true, elapsedMs, durationMs, stacks, event: 'stop' });
        }
        if (segment.kind === 'turn' && segment.stackId && segment.direction) {
          const turning = segment.from.find(stack => stack.id === segment.stackId);
          let delta = screenAngle(segment.direction) - screenAngle(turning?.launchDirection);
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          const stacks = segment.from.map(stack => stack.id === segment.stackId ? { ...stack, turnRotation: delta * ease(progress) } : stack);
          return Object.freeze({ active: true, elapsedMs, durationMs, stacks, event: 'turn' });
        }
        if (segment.kind !== 'move' || !segment.stackId || !segment.start || !segment.end) {
          return Object.freeze({ active: true, elapsedMs, durationMs, stacks: segment.from, event: segment.kind });
        }
        const t = ease(progress);
        const moving = segment.from.find(stack => stack.id === segment.stackId);
        const absorptionT = Math.max(0, Math.min(1, (progress - MOVE_TIMINGS.absorptionStart) / (1 - MOVE_TIMINGS.absorptionStart)));
        const stacks = segment.from.flatMap(stack => {
          if (stack.id === segment.absorbedId && absorptionT > 0) return [];
          if (stack.id !== segment.stackId) return [stack];
          const height = segment.heightFrom! + (segment.heightTo! - segment.heightFrom!) * ease(absorptionT);
          const impulse = reducedMotion ? 0 : Math.sin(progress * Math.PI) * 0.19;
          return [{ ...stack, u: segment.start!.u + (segment.end!.u - segment.start!.u) * t,
            v: segment.start!.v + (segment.end!.v - segment.start!.v) * t, height,
            tilt: impulse, lift: absorptionT ? Math.sin(absorptionT * Math.PI) * 0.16 : 0 }];
        });
        return Object.freeze({ active: true, elapsedMs, durationMs, stacks, event: segment.absorbedId && absorptionT > 0 ? 'merge' : 'move' });
      }
      cursor += segment.duration;
    }
    return Object.freeze({ active: false, elapsedMs, durationMs, stacks: segments.at(-1)?.to ?? baseStacks });
  }

  function start(input: { stacks: readonly Stack[]; steps: readonly MoveStep[]; events: readonly MoveEvent[]; generationId: number; reducedMotion?: boolean; speed?: number }): void {
    if (disposed) return;
    reset();
    generationId = input.generationId;
    reducedMotion = !!input.reducedMotion;
    speed = Math.max(0.25, Math.min(3, input.speed ?? 1));
    baseStacks = input.stacks.map(stack => ({ ...stack }));
    let working = baseStacks.map(stack => ({ ...stack }));
    const built: Segment[] = [];
    const scheduled: ScheduledCue[] = [];
    let timeline = 0;
    const add = (segment: Segment) => { built.push(segment); working = segment.to.map(stack => ({ ...stack })); };
    input.steps.forEach((step, index) => {
      const moving = working.find(stack => stack.u === step.from.u && stack.v === step.from.v);
      if (!moving) return;
      const target = step.absorbed ? working.find(stack => stack.u === step.to.u && stack.v === step.to.v) : undefined;
      const before = working;
      let after = working.filter(stack => stack.id !== target?.id).map(stack => stack.id === moving.id
        ? { ...stack, u: step.to.u, v: step.to.v, height: step.movingHeightAfter }
        : stack);
      const duration = (reducedMotion ? MOVE_TIMINGS.reducedStepMs : MOVE_TIMINGS.stepMs) / speed;
      add({ kind: 'move', duration, from: before, to: after, stackId: moving.id, start: step.from, end: step.to,
        heightFrom: step.movingHeightBefore, heightTo: step.movingHeightAfter, ...(target ? { absorbedId: target.id } : {}) });
      if (step.absorbed) scheduled.push(Object.freeze({ atMs: timeline + duration * MOVE_TIMINGS.absorptionStart, cue: 'merge' }));
      timeline += duration;
      const turn = input.events.find(event => event.type === 'turn' && event.stepIndex === index);
      if (turn?.type === 'turn') {
        scheduled.push(Object.freeze({ atMs: timeline, cue: 'turn' }));
        const turned = working.map(stack => stack.id === moving.id ? { ...stack, launchDirection: turn.direction } : stack);
        const turnDuration = (reducedMotion ? MOVE_TIMINGS.reducedTurnMs : MOVE_TIMINGS.turnMs) / speed;
        add({ kind: 'turn', duration: turnDuration, from: working, to: turned, stackId: moving.id, direction: turn.direction });
        timeline += turnDuration;
      }
    });
    const stopDuration = (reducedMotion ? MOVE_TIMINGS.reducedStopMs : MOVE_TIMINGS.stopMs) / speed;
    const lastMovedId = input.steps.length ? baseStacks.find(stack => stack.u === input.steps[0]?.from.u && stack.v === input.steps[0]?.from.v)?.id : undefined;
    const moverId = working.find(stack => stack.id === lastMovedId)?.id ?? lastMovedId;
    if (Math.max(0, ...working.map(stack => stack.height)) >= 3) scheduled.push(Object.freeze({ atMs: timeline + stopDuration, cue: 'settle' }));
    built.push({ kind: 'stop', duration: stopDuration, from: working, to: working, ...(moverId ? { stackId: moverId } : {}) });
    cues = Object.freeze(scheduled.sort((a, b) => a.atMs - b.atMs));
    segments = built;
    elapsedMs = 0;
    durationMs = built.reduce((sum, segment) => sum + segment.duration, 0);
    active = true;
    paused = false;
    cached = makeSnapshot();
    if (!segments.length) finish();
  }

  function finish(): void {
    if (!active) return;
    active = false;
    elapsedMs = durationMs;
    cached = Object.freeze({ active: false, elapsedMs, durationMs, stacks: segments.at(-1)?.to ?? baseStacks });
    options.onComplete?.(generationId);
  }

  function update(dt: number): AnimationSnapshot {
    if (disposed || !active || paused || !Number.isFinite(dt) || dt <= 0) return cached;
    const previousMs = elapsedMs;
    elapsedMs = Math.min(durationMs, elapsedMs + dt * 1000);
    for (const cue of cues) if (cue.atMs > previousMs && cue.atMs <= elapsedMs) {
      try { options.onCue?.(cue.cue); } catch { /* presentation must remain independent of optional audio */ }
    }
    cached = makeSnapshot();
    if (elapsedMs >= durationMs) finish();
    return cached;
  }
  function reset(): void {
    active = false; paused = false; segments = []; elapsedMs = 0; durationMs = 0; baseStacks = []; cues = [];
    cached = Object.freeze({ active: false, elapsedMs: 0, durationMs: 0, stacks: [] });
  }
  return Object.freeze({
    start,
    update,
    snapshot: () => cached,
    pause(value: boolean) { paused = value; },
    reset,
    dispose() { if (disposed) return; reset(); disposed = true; },
  });
}
