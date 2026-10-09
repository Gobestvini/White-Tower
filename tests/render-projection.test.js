import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAMERA_PITCH, FLOOR_RADIUS, LAYER_RISE, MAX_PROJECTION_SCALE, TILE_RADIUS, TILE_STEP, createProjection, getLevelBounds, pitchScreenPoint, screenToWorld, unpitchScreenPoint, worldToScreen } from '../src/render/projection.ts';
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
  assert.deepEqual(screen, { x: 450, y: 426 });
  const logical = screenToWorld(screen, 4, projection);
  assert.ok(Math.abs(logical.u - 2) < 1e-12);
  assert.ok(Math.abs(logical.v - 1) < 1e-12);
});

test('reference projection reserves the maximum stack height within the pitched camera frame', () => {
  const level = loadLevel(6);
  const projection = createProjection(level);
  const bounds = getLevelBounds(level);
  const lowerBounds = getLevelBounds(level, 1);
  assert.ok(projection.scale > 0 && projection.scale <= MAX_PROJECTION_SCALE);
  assert.equal(bounds.width, bounds.maxX - bounds.minX);
  assert.ok(bounds.height > lowerBounds.height);
  const initial = worldToScreen(0, 0, 0, projection);
  const tall = worldToScreen(0, 0, level.totalTiles - 1, projection);
  assert.equal(initial.x, tall.x);
  assert.ok(Math.abs(initial.y - tall.y - (level.totalTiles - 1) * LAYER_RISE * projection.scale) < 1e-9);
  const pitched = pitchScreenPoint(initial);
  assert.ok(Math.abs(pitched.y - 640) < Math.abs(initial.y - 640));
  assert.deepEqual(unpitchScreenPoint(pitched), initial);
});

test('projection fits sparse, ring and dense reference levels with calibrated scale', () => {
  const levels = [loadLevel(1), loadLevel(6), loadLevel(7), loadLevel(9), loadLevel(11)];
  const scales = levels.map(level => createProjection(level).scale);
  assert.ok(scales.every(scale => scale > 0 && scale <= MAX_PROJECTION_SCALE));
  assert.ok(new Set(scales).size > 1);
  assert.ok(CAMERA_PITCH < 1);
  assert.equal(TILE_RADIUS, TILE_STEP, 'white tiles share the grid footprint');
  assert.equal(FLOOR_RADIUS, TILE_RADIUS, 'revealed floor matches the white tile footprint');
});

test('adjacent tile edges coincide with the floor grid at every camera scale', () => {
  for (const scale of [0.5, 0.85, 1, 1.33]) {
    const projection = { scale, originX: 360, originY: 760, layerRise: LAYER_RISE };
    const a = worldToScreen(0, 0, 0, projection);
    const b = worldToScreen(1, 0, 0, projection);
    const radius = TILE_RADIUS * scale;
    assert.ok(Math.abs(a.x + radius - b.x) < 1e-9);
    assert.ok(Math.abs(a.y - (b.y + radius)) < 1e-9);
    assert.ok(Math.abs(a.x - (b.x - radius)) < 1e-9);
    assert.ok(Math.abs(a.y - radius - b.y) < 1e-9);
  }
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
