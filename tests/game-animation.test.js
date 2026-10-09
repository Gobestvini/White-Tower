import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAnimationPlayer } from '../src/presentation/animation.ts';
import { validateLevel } from '../src/game/level-schema.js';
import { createInitialState } from '../src/game/model.js';
import { simulateMove } from '../src/game/simulator.js';

const examples = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels;
const reference = ['level-006', 'level-008', 'level-010'].map(id => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/content/levels/${id.slice(-3)}.json`, import.meta.url)), 'utf8')));
const getLevel = id => {
  const result = validateLevel([...examples, ...reference].find(level => level.id === id));
  assert.ok(result.ok);
  return result.value;
};

function play(level, start, frameMs, options = {}) {
  const initial = createInitialState(level);
  const move = simulateMove(level, initial, start);
  assert.equal(move.accepted, true);
  let completions = 0;
  let completedGeneration;
  const player = createAnimationPlayer({ onComplete: id => { completions++; completedGeneration = id; } });
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 42, ...options });
  const snapshots = [];
  let guard = 0;
  while (player.snapshot().active && guard++ < 20000) snapshots.push(player.update(frameMs / 1000));
  assert.ok(guard < 20000, 'animation terminates');
  return { initial, move, player, snapshots, completions, completedGeneration };
}

test('A and D routes animate every cell, turn and merge before stop without mutating committed state', () => {
  for (const [id, start] of [['A_line', { u: 0, v: 0 }], ['D_ring', { u: 0, v: 0 }]]) {
    const level = getLevel(id);
    const result = play(level, start, 16);
    assert.equal(result.move.accepted, true);
    assert.ok(result.snapshots.some(snapshot => snapshot.event === 'move'));
    assert.ok(result.snapshots.some(snapshot => snapshot.event === 'merge'));
    if (id === 'D_ring') {
      assert.ok(result.move.events.some(event => event.type === 'turn'));
      assert.ok(result.snapshots.some(snapshot => snapshot.event === 'turn' && snapshot.stacks.some(stack => Math.abs(stack.turnRotation ?? 0) > 0)));
    }
    assert.equal(result.snapshots.at(-1).event, undefined);
    assert.deepEqual(result.initial, createInitialState(level));
    assert.equal(result.completions, 1);
    assert.equal(result.completedGeneration, 42);
    assert.deepEqual(result.player.snapshot().stacks.map(({ id: stackId, u, v, height }) => ({ id: stackId, u, v, height })), result.move.nextState.stacks);
  }
});

test('merge, turn and large-stack settling cues align with presentation time', () => {
  const cues = [];
  const level = getLevel('D_ring');
  const initial = createInitialState(level);
  const move = simulateMove(level, initial, { u: 0, v: 0 });
  assert.equal(move.accepted, true);
  const player = createAnimationPlayer({ onCue: cue => cues.push({ cue, time: player.snapshot().elapsedMs }) });
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 31 });
  assert.deepEqual(cues, [], 'no cue fires from the committed move before presentation advances');
  player.update(0.06);
  assert.equal(cues[0]?.cue, 'merge', 'merge sound is scheduled at the visual contact point');
  let guard = 0;
  while (player.snapshot().active && guard++ < 300) player.update(0.016);
  assert.ok(cues.some(item => item.cue === 'turn'));
  assert.ok(cues.some(item => item.cue === 'settle'));
  assert.ok(cues.every(item => item.time >= 0));
});

test('30/60/120/144 Hz and a long frame stall produce the same final pose and one completion', () => {
  const level = getLevel('D_ring');
  const baseline = play(level, { u: 0, v: 0 }, 1000);
  for (const frameMs of [1000 / 30, 1000 / 60, 1000 / 120, 1000 / 144, 5000]) {
    const current = play(level, { u: 0, v: 0 }, frameMs);
    assert.deepEqual(current.player.snapshot().stacks, baseline.player.snapshot().stacks);
    assert.deepEqual(current.move.nextState, baseline.move.nextState);
    assert.equal(current.completions, 1);
  }
});

test('pause freezes progress, reduced motion preserves the route, and reset cancels completion', () => {
  const level = getLevel('A_line');
  const initial = createInitialState(level);
  const move = simulateMove(level, initial, { u: 0, v: 0 });
  let completions = 0;
  const player = createAnimationPlayer({ onComplete: () => completions++ });
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 7 });
  player.update(0.06);
  const pausedAt = player.snapshot();
  player.pause(true);
  assert.equal(player.update(10), pausedAt);
  player.pause(false);
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 8, reducedMotion: true });
  assert.ok(player.snapshot().durationMs <= 400);
  player.update(10);
  assert.equal(completions, 1);
  assert.deepEqual(player.snapshot().stacks.map(({ id, u, v, height }) => ({ id, u, v, height })), move.nextState.stacks);
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 9 });
  player.reset();
  player.update(10);
  assert.equal(completions, 1);
});

test('large stack merge lifts its new layers instead of changing committed rules', () => {
  const level = getLevel('level-006');
  const initial = createInitialState(level);
  const start = level.knownSolution[0];
  const move = simulateMove(level, initial, start);
  assert.equal(move.accepted, true);
  assert.ok(move.steps.some(step => step.movingHeightAfter > step.movingHeightBefore));
  const player = createAnimationPlayer();
  player.start({ stacks: initial.stacks, steps: move.steps, events: move.events, generationId: 1 });
  const poses = [];
  while (player.snapshot().active) poses.push(player.update(0.02));
  assert.ok(poses.some(snapshot => snapshot.stacks.some(stack => stack.height % 1 > 0 && stack.lift > 0)));
  assert.deepEqual(initial, createInitialState(level));
});
