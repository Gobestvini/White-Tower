export const DIRECTION_VECTORS = {
  SE: { u: 1, v: 0 }, SW: { u: 0, v: 1 }, NW: { u: -1, v: 0 }, NE: { u: 0, v: -1 },
  E: { u: 1, v: -1 }, W: { u: -1, v: 1 }, N: { u: -1, v: -1 }, S: { u: 1, v: 1 },
} as const;

export type Direction = keyof typeof DIRECTION_VECTORS;
export const DIRECTIONS = Object.keys(DIRECTION_VECTORS) as Direction[];

export function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && Object.hasOwn(DIRECTION_VECTORS, value);
}
