import type { Level } from '../game/model.js';

export const ARTBOARD = Object.freeze({ width: 720, height: 1280 });
export const TILE_STEP = 80;
export const TILE_RADIUS = TILE_STEP * 0.94;
export const LAYER_RISE = 0.16 * TILE_STEP;

export type ScreenPoint = Readonly<{ x: number; y: number }>;
export type Projection = Readonly<{
  scale: number;
  originX: number;
  originY: number;
  layerRise: number;
}>;
export type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }>;

export function worldToScreen(u: number, v: number, height: number, projection: Projection): ScreenPoint {
  return Object.freeze({
    x: projection.originX + (u - v) * TILE_STEP * projection.scale,
    y: projection.originY - (u + v) * TILE_STEP * projection.scale - height * projection.layerRise * projection.scale,
  });
}

export function screenToWorld(point: ScreenPoint, height: number, projection: Projection): Readonly<{ u: number; v: number }> {
  const horizontal = (point.x - projection.originX) / (TILE_STEP * projection.scale);
  const vertical = -(point.y - projection.originY + height * projection.layerRise * projection.scale) / (TILE_STEP * projection.scale);
  return Object.freeze({ u: (horizontal + vertical) / 2, v: (vertical - horizontal) / 2 });
}

function rawBounds(level: Level, maxHeight: number): Bounds {
  const xValues = level.cells.map(cell => (cell.u - cell.v) * TILE_STEP);
  const yValues = level.cells.map(cell => -(cell.u + cell.v) * TILE_STEP);
  const minX = Math.min(...xValues) - TILE_RADIUS;
  const maxX = Math.max(...xValues) + TILE_RADIUS;
  const minY = Math.min(...yValues) - TILE_RADIUS - maxHeight * LAYER_RISE;
  const maxY = Math.max(...yValues) + TILE_RADIUS;
  return Object.freeze({ minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY });
}

export function getLevelBounds(level: Level, maxHeight = level.totalTiles): Bounds {
  return rawBounds(level, maxHeight);
}

export function createProjection(level: Level, maxHeight = level.totalTiles): Projection {
  const bounds = rawBounds(level, maxHeight);
  const safeWidth = 600;
  const safeHeight = 690;
  const scale = Math.min(1.25, safeWidth / bounds.width, safeHeight / bounds.height);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return Object.freeze({
    scale,
    originX: 360 - centerX * scale,
    originY: 760 - centerY * scale,
    layerRise: LAYER_RISE,
  });
}
