import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProjection, getLevelBounds, screenToWorld, worldToScreen } from '../src/render/projection.ts';
import { createInitialState, validateLevel } from '../src/game/level-schema.js';
import { DIRECTIONS } from '../src/game/directions.js';
import { createArrowGeometry, createChevronGeometry, createDiamondGeometry, createSideGeometry } from '../src/render/geometry.ts';

const loadLevel = number => {
  const path = fileURLToPath(new URL(`../public/content/levels/${String(number).padStart(3, '0')}.json`, import.meta.url));
  const result = validateLevel(JSON.parse(readFileSync(path, 'utf8')));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Invalid fixture level.');
  return result.value;
};

test('logical coordinates project to the reference axes and invert at any layer height', () => {
  const projection = Object.freeze({ scale: 1.25, originX: 360, originY: 760, layerRise: 12.8 });
  const screen = worldToScreen(2, 1, 4, projection);
  assert.deepEqual(screen, { x: 460, y: 396 });
  const logical = screenToWorld(screen, 4, projection);
  assert.ok(Math.abs(logical.u - 2) < 1e-12);
  assert.ok(Math.abs(logical.v - 1) < 1e-12);
});

test('reference projection is uniform and reserves the maximum possible stack height', () => {
  const level = loadLevel(6);
  const projection = createProjection(level);
  const bounds = getLevelBounds(level);
  const lowerBounds = getLevelBounds(level, 1);
  assert.ok(projection.scale > 0 && projection.scale <= 1.25);
  assert.equal(bounds.width, bounds.maxX - bounds.minX);
  assert.ok(bounds.height > lowerBounds.height);
  const initial = worldToScreen(0, 0, 0, projection);
  const tall = worldToScreen(0, 0, level.totalTiles - 1, projection);
  assert.equal(initial.x, tall.x);
  assert.ok(Math.abs(initial.y - tall.y - (level.totalTiles - 1) * 12.8 * projection.scale) < 1e-9);
});

test('projection fits sparse, ring and dense reference levels without changing aspect', () => {
  const levels = [loadLevel(1), loadLevel(6), loadLevel(7), loadLevel(9), loadLevel(11)];
  const scales = levels.map(level => createProjection(level).scale);
  assert.ok(scales.every(scale => scale > 0 && scale <= 1.25));
  assert.ok(new Set(scales).size > 1);
});

test('procedural tile and arrow geometry is reusable and non-empty in every direction', () => {
  const top = createDiamondGeometry(75);
  const sides = createSideGeometry(75, 9);
  assert.equal(top.getAttribute('position').count, 12);
  assert.equal(sides.getAttribute('position').count, 12);
  assert.equal(sides.groups.length, 2);
  for (const direction of DIRECTIONS) {
    const arrow = createArrowGeometry(direction);
    const chevron = createChevronGeometry(direction);
    assert.ok(arrow.getAttribute('position').count >= 21);
    assert.ok(chevron.getAttribute('position').count >= 24);
    arrow.dispose();
    chevron.dispose();
  }
  top.dispose();
  sides.dispose();
});
