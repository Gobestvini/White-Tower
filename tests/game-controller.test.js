import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGameController } from '../src/game/controller.js';
import { validateLevel } from '../src/game/level-schema.js';

const fixtures = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels;
function level(index) {
  const result = validateLevel(fixtures[index]);
  assert.ok(result.ok);
  return result.value;
}

test('launch commits one complete route, locks commands during animation and ignores duplicate finish', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  const before = controller.snapshot();
  const animating = controller.launch({ u: 0, v: 0 });
  assert.equal(animating.phase, 'Animating');
  assert.equal(animating.committedState.stacks[0]?.height, 4);
  assert.equal(animating.displayedState.stacks[0]?.height, 1);
  assert.equal(controller.launch({ u: 0, v: 0 }).generationId, animating.generationId);
  assert.equal(controller.undo().phase, 'Animating');
  assert.equal(controller.restart().phase, 'Animating');
  const won = controller.finishAnimation(animating.generationId);
  assert.equal(won.phase, 'Won');
  const duplicate = controller.finishAnimation(animating.generationId);
  assert.equal(duplicate.phase, 'Won');
  assert.deepEqual(duplicate.completedLevelIds, ['A_line']);
  assert.notEqual(before, animating);
});

test('Undo after the D ring restores all five stacks and active route arrow', () => {
  const controller = createGameController();
  controller.loadLevel(level(3));
  const initial = controller.snapshot().committedState;
  const route = controller.launch({ u: 0, v: 0 });
  assert.equal(route.phase, 'Animating');
  controller.finishAnimation(route.generationId);
  const restored = controller.undo();
  assert.equal(restored.phase, 'Idle');
  assert.equal(restored.committedState.stacks.length, 5);
  assert.deepEqual(restored.committedState, initial);
  assert.equal(restored.canUndo, false);
});

test('Undo after victory hides victory while retaining completed progress', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  const route = controller.launch({ u: 0, v: 0 });
  controller.finishAnimation(route.generationId);
  const undone = controller.undo();
  assert.equal(undone.phase, 'Idle');
  assert.deepEqual(undone.completedLevelIds, ['A_line']);
  assert.equal(undone.committedState.stacks.length, 4);
});

test('Restart clears Undo history and advances attempt/generation without clearing completion', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  const firstAttempt = controller.snapshot().attemptId;
  const route = controller.launch({ u: 0, v: 0 });
  controller.finishAnimation(route.generationId);
  const restarted = controller.restart();
  assert.equal(restarted.phase, 'Idle');
  assert.equal(restarted.attemptId, firstAttempt + 1);
  assert.equal(restarted.generationId, route.generationId + 1);
  assert.equal(restarted.canUndo, false);
  assert.deepEqual(restarted.completedLevelIds, ['A_line']);
  assert.equal(restarted.committedState.stacks.length, 4);
});

test('menu only opens in stable phases and returns to the prior phase', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  assert.equal(controller.openMenu().phase, 'Menu');
  assert.equal(controller.closeMenu().phase, 'Idle');
  const route = controller.launch({ u: 0, v: 0 });
  assert.equal(controller.openMenu().phase, 'Animating');
  assert.equal(controller.finishAnimation(route.generationId).phase, 'Won');
  assert.equal(controller.openMenu().phase, 'Menu');
  assert.equal(controller.closeMenu().phase, 'Won');
});

test('new level, load error and dispose invalidate stale animation callbacks', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  const old = controller.launch({ u: 0, v: 0 });
  const secondLevel = controller.loadLevel(level(1));
  assert.equal(secondLevel.phase, 'Idle');
  assert.equal(controller.finishAnimation(old.generationId).phase, 'Idle');
  const next = controller.launch({ u: 2, v: 0 });
  const error = controller.setLoadError('bad level');
  assert.equal(error.phase, 'LoadError');
  assert.equal(controller.finishAnimation(next.generationId).phase, 'LoadError');
  const unsupported = controller.setUnsupported();
  assert.equal(unsupported.phase, 'Unsupported');
  controller.dispose();
  assert.equal(controller.loadLevel(level(0)).phase, 'Unsupported');
});

test('animation presentation remains paused until explicit completion; snapshots are immutable', () => {
  const controller = createGameController();
  controller.loadLevel(level(0));
  const result = controller.launch({ u: 0, v: 0 });
  const displayed = controller.snapshot().displayedState;
  assert.equal(controller.snapshot().phase, 'Animating');
  assert.equal(controller.snapshot().displayedState, displayed);
  assert.equal(Object.isFrozen(displayed.stacks), true);
  controller.finishAnimation(result.generationId);
  assert.equal(controller.snapshot().displayedState.stacks[0]?.height, 4);
});
