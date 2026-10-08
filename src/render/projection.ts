import type { Level } from '../game/model.js';

export const ARTBOARD = Object.freeze({ width: 720, height: 1280 });
export const TILE_STEP = 80;
export const TILE_RADIUS = TILE_STEP * 0.94;
export const LAYER_RISE = 0.16 * TILE_STEP;

export type ScreenPoint = Readonly<{ x: number; y: number }>;
export type ClientRect = Readonly<{ left: number; top: number; width: number; height: number }>;
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

export function clientToArtboard(clientX: number, clientY: number, rect: ClientRect): ScreenPoint | undefined {
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const scale = Math.min(rect.width / ARTBOARD.width, rect.height / ARTBOARD.height);
  const offsetX = (rect.width - ARTBOARD.width * scale) / 2;
  const offsetY = (rect.height - ARTBOARD.height * scale) / 2;
  const x = (clientX - rect.left - offsetX) / scale;
  const y = (clientY - rect.top - offsetY) / scale;
  if (x < 0 || y < 0 || x > ARTBOARD.width || y > ARTBOARD.height) return undefined;
  return Object.freeze({ x, y });
}

function pointInPolygon(point: ScreenPoint, polygon: readonly ScreenPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!; const b = polygon[previous]!;
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pickVisibleStack(point: ScreenPoint, stacks: readonly Readonly<{ id: string; u: number; v: number; height: number }>[], projection: Projection): string | undefined {
  const ordered = [...stacks].sort((a, b) => b.u + b.v - a.u - a.v || b.u - a.u || b.v - a.v);
  for (const stack of ordered) {
    for (let layer = stack.height - 1; layer >= 0; layer--) {
      const center = worldToScreen(stack.u, stack.v, layer, projection);
      const dx = Math.abs(point.x - center.x); const dy = Math.abs(point.y - center.y);
      if (dx + dy <= TILE_RADIUS) return stack.id;
      const bottom = { x: center.x, y: center.y + TILE_RADIUS };
      const right = { x: center.x + TILE_RADIUS, y: center.y };
      const left = { x: center.x - TILE_RADIUS, y: center.y };
      const lowerBottom = { x: bottom.x, y: bottom.y + 9 };
      const lowerRight = { x: right.x, y: right.y + 9 };
      const lowerLeft = { x: left.x, y: left.y + 9 };
      if (pointInPolygon(point, [right, bottom, lowerBottom, lowerRight]) || pointInPolygon(point, [bottom, left, lowerLeft, lowerBottom])) return undefined;
    }
  }
  return undefined;
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
