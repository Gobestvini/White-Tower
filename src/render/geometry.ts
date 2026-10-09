import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { DIRECTION_VECTORS, type Direction } from '../game/directions.js';

function geometryFromTriangles(vertices: readonly number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function pushTriangle(target: number[], a: readonly number[], b: readonly number[], c: readonly number[]): void {
  target.push(...a, ...b, ...c);
}

export function createDiamondGeometry(radius: number): BufferGeometry {
  const top = [0, radius, 0] as const;
  const right = [radius, 0, 0] as const;
  const bottom = [0, -radius, 0] as const;
  const left = [-radius, 0, 0] as const;
  const center = [0, 0, 0] as const;
  const vertices: number[] = [];
  pushTriangle(vertices, center, top, right);
  pushTriangle(vertices, center, right, bottom);
  pushTriangle(vertices, center, bottom, left);
  pushTriangle(vertices, center, left, top);
  return geometryFromTriangles(vertices);
}

export function createBevelGeometry(radius: number, inset: number): BufferGeometry {
  const outer = [[0, radius, 0], [radius, 0, 0], [0, -radius, 0], [-radius, 0, 0]] as const;
  const innerRadius = radius - inset;
  const inner = [[0, innerRadius, 0], [innerRadius, 0, 0], [0, -innerRadius, 0], [-innerRadius, 0, 0]] as const;
  const vertices: number[] = [];
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;
    pushTriangle(vertices, outer[index]!, outer[next]!, inner[next]!);
    pushTriangle(vertices, outer[index]!, inner[next]!, inner[index]!);
  }
  return geometryFromTriangles(vertices);
}

export function createSideGeometry(radius: number, thickness: number): BufferGeometry {
  const right = [radius, 0, 0] as const;
  const bottom = [0, -radius, 0] as const;
  const left = [-radius, 0, 0] as const;
  const lower = (point: readonly number[]) => [point[0], point[1] - thickness, 0] as const;
  const vertices: number[] = [];
  // The two screen-facing rhombus edges form the visible front of the extrusion.
  pushTriangle(vertices, right, bottom, lower(bottom));
  pushTriangle(vertices, right, lower(bottom), lower(right));
  pushTriangle(vertices, bottom, left, lower(left));
  pushTriangle(vertices, bottom, lower(left), lower(bottom));
  const geometry = geometryFromTriangles(vertices);
  geometry.clearGroups();
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, 6, 1);
  return geometry;
}

export function createDiamondOutlineGeometry(radius: number): BufferGeometry {
  const points = [[0, radius, 0.1], [radius, 0, 0.1], [0, -radius, 0.1], [-radius, 0, 0.1], [0, radius, 0.1]] as const;
  const vertices: number[] = [];
  for (let index = 0; index < points.length - 1; index++) vertices.push(...points[index]!, ...points[index + 1]!);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createArrowGeometry(direction: Direction, length = 48, width = 21): BufferGeometry {
  const vector = DIRECTION_VECTORS[direction];
  const dx = vector.u - vector.v;
  const dy = vector.u + vector.v;
  const magnitude = Math.hypot(dx, dy) || 1;
  const forward = { x: dx / magnitude, y: dy / magnitude };
  const perpendicular = { x: -forward.y, y: forward.x };
  const tip = { x: forward.x * length / 2, y: forward.y * length / 2 };
  const shoulder = { x: -forward.x * length * 0.08, y: -forward.y * length * 0.08 };
  const shaftEnd = { x: -forward.x * length / 2, y: -forward.y * length / 2 };
  const points = [
    tip,
    { x: shoulder.x + perpendicular.x * width / 2, y: shoulder.y + perpendicular.y * width / 2 },
    { x: shoulder.x + perpendicular.x * width * 0.22, y: shoulder.y + perpendicular.y * width * 0.22 },
    { x: shaftEnd.x + perpendicular.x * width * 0.22, y: shaftEnd.y + perpendicular.y * width * 0.22 },
    { x: shaftEnd.x - perpendicular.x * width * 0.22, y: shaftEnd.y - perpendicular.y * width * 0.22 },
    { x: shoulder.x - perpendicular.x * width * 0.22, y: shoulder.y - perpendicular.y * width * 0.22 },
    { x: shoulder.x - perpendicular.x * width / 2, y: shoulder.y - perpendicular.y * width / 2 },
  ];
  const vertices: number[] = [];
  const center = [0, 0, 0] as const;
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    pushTriangle(vertices, center, [a.x, a.y, 0], [b.x, b.y, 0]);
  }
  return geometryFromTriangles(vertices);
}

export function createChevronGeometry(direction: Direction, size = 28, lineWidth = 4): BufferGeometry {
  const vector = DIRECTION_VECTORS[direction];
  const dx = vector.u - vector.v;
  const dy = vector.u + vector.v;
  const magnitude = Math.hypot(dx, dy) || 1;
  const forward = { x: dx / magnitude, y: dy / magnitude };
  const perpendicular = { x: -forward.y, y: forward.x };
  const vertices: number[] = [];
  for (const offset of [-9, 9]) {
    const tip = { x: forward.x * offset, y: forward.y * offset };
    const back = { x: tip.x - forward.x * size * 0.42, y: tip.y - forward.y * size * 0.42 };
    const left = { x: back.x + perpendicular.x * size * 0.27, y: back.y + perpendicular.y * size * 0.27 };
    const right = { x: back.x - perpendicular.x * size * 0.27, y: back.y - perpendicular.y * size * 0.27 };
    const half = lineWidth / 2;
    const leftA = [left.x + perpendicular.x * half, left.y + perpendicular.y * half, 0] as const;
    const leftB = [left.x - perpendicular.x * half, left.y - perpendicular.y * half, 0] as const;
    const tipA = [tip.x + perpendicular.x * half, tip.y + perpendicular.y * half, 0] as const;
    const tipB = [tip.x - perpendicular.x * half, tip.y - perpendicular.y * half, 0] as const;
    const rightA = [right.x + perpendicular.x * half, right.y + perpendicular.y * half, 0] as const;
    const rightB = [right.x - perpendicular.x * half, right.y - perpendicular.y * half, 0] as const;
    pushTriangle(vertices, leftA, tipA, tipB);
    pushTriangle(vertices, leftA, tipB, leftB);
    pushTriangle(vertices, tipA, rightA, rightB);
    pushTriangle(vertices, tipA, rightB, tipB);
  }
  return geometryFromTriangles(vertices);
}

export function createShadowGeometry(segments = 32): BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  const inner = new Color('#54ACEB');
  const outer = new Color('#60C0FE');
  const rings = 5;
  for (let ring = 0; ring < rings; ring++) {
    const radiusA = ring / rings;
    const radiusB = (ring + 1) / rings;
    const colorA = inner.clone().lerp(outer, radiusA * radiusA);
    const colorB = inner.clone().lerp(outer, radiusB * radiusB);
    for (let index = 0; index < segments; index++) {
      const start = (index / segments) * Math.PI * 2;
      const end = ((index + 1) / segments) * Math.PI * 2;
      const diamondPoint = (angle: number) => {
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        const length = Math.abs(x) + Math.abs(y);
        return [x / length, y / length, 0] as const;
      };
      const a = diamondPoint(start);
      const b = diamondPoint(end);
      const outerA = [a[0] * radiusB, a[1] * radiusB, 0] as const;
      const outerB = [b[0] * radiusB, b[1] * radiusB, 0] as const;
      const innerA = [a[0] * radiusA, a[1] * radiusA, 0] as const;
      const innerB = [b[0] * radiusA, b[1] * radiusA, 0] as const;
      pushTriangle(vertices, innerA, outerA, outerB);
      pushTriangle(vertices, innerA, outerB, innerB);
      for (const color of [colorA, colorB, colorB, colorA, colorB, colorA]) colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = geometryFromTriangles(vertices);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
