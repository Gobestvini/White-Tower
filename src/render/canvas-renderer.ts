import type { Level, Stack } from '../game/model.js';
import { DIRECTION_VECTORS, type Direction } from '../game/directions.js';
import { ARTBOARD, TILE_RADIUS, worldToScreen, createProjection, pickVisibleStack, type Projection } from './projection.js';
import { WHITE_TOWER_COLORS, type RenderViewState } from './presets.js';
import type { RenderViewport, WhiteTowerRenderer } from './webgl-renderer.js';

const key = (u: number, v: number) => `${u},${v}`;
const screenVector = (direction: Direction) => {
  const vector = DIRECTION_VECTORS[direction];
  const x = vector.u - vector.v;
  const y = -(vector.u + vector.v);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

export function createCanvasRenderer(canvas: HTMLCanvasElement): WhiteTowerRenderer {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  let viewport: RenderViewport = { width: 1, height: 1, pixelRatio: 1 };
  let projection: Projection | undefined;
  let view: RenderViewState | undefined;
  let disposed = false;

  function drawDiamond(x: number, y: number, radius: number, fill: string, stroke?: string): void {
    context!.beginPath();
    context!.moveTo(x, y - radius);
    context!.lineTo(x + radius, y);
    context!.lineTo(x, y + radius);
    context!.lineTo(x - radius, y);
    context!.closePath();
    context!.fillStyle = fill;
    context!.fill();
    if (stroke) { context!.strokeStyle = stroke; context!.lineWidth = 1; context!.stroke(); }
  }

  function drawArrow(x: number, y: number, direction: Direction, length = 48, width = 21): void {
    const forward = screenVector(direction);
    const perpendicular = { x: -forward.y, y: forward.x };
    const tip = { x: forward.x * length / 2, y: forward.y * length / 2 };
    const shoulder = { x: -forward.x * length * 0.08, y: -forward.y * length * 0.08 };
    const tail = { x: -forward.x * length / 2, y: -forward.y * length / 2 };
    const points = [tip,
      { x: shoulder.x + perpendicular.x * width / 2, y: shoulder.y + perpendicular.y * width / 2 },
      { x: shoulder.x + perpendicular.x * width * 0.22, y: shoulder.y + perpendicular.y * width * 0.22 },
      { x: tail.x + perpendicular.x * width * 0.22, y: tail.y + perpendicular.y * width * 0.22 },
      { x: tail.x - perpendicular.x * width * 0.22, y: tail.y - perpendicular.y * width * 0.22 },
      { x: shoulder.x - perpendicular.x * width * 0.22, y: shoulder.y - perpendicular.y * width * 0.22 },
      { x: shoulder.x - perpendicular.x * width / 2, y: shoulder.y - perpendicular.y * width / 2 },
    ];
    context!.beginPath();
    context!.moveTo(x + points[0]!.x, y + points[0]!.y);
    for (const point of points.slice(1)) context!.lineTo(x + point.x, y + point.y);
    context!.closePath();
    context!.fillStyle = WHITE_TOWER_COLORS.arrow;
    context!.fill();
  }

  function drawChevron(x: number, y: number, direction: Direction): void {
    const forward = screenVector(direction);
    const perpendicular = { x: -forward.y, y: forward.x };
    context!.strokeStyle = WHITE_TOWER_COLORS.chevron;
    context!.lineWidth = 4;
    context!.lineCap = 'round';
    context!.lineJoin = 'round';
    for (const offset of [-9, 9]) {
      const tip = { x: x + forward.x * offset, y: y + forward.y * offset };
      const backX = tip.x - forward.x * 12;
      const backY = tip.y - forward.y * 12;
      context!.beginPath();
      context!.moveTo(backX + perpendicular.x * 8, backY + perpendicular.y * 8);
      context!.lineTo(tip.x, tip.y);
      context!.lineTo(backX - perpendicular.x * 8, backY - perpendicular.y * 8);
      context!.stroke();
    }
  }

  function drawStack(stack: Stack, selectedProjection: Projection): void {
    const base = worldToScreen(stack.u, stack.v, 0, selectedProjection);
    const gradient = context!.createRadialGradient(base.x - 25, base.y + 24, 1, base.x - 25, base.y + 24, 48);
    gradient.addColorStop(0, 'rgba(61,131,210,0.58)');
    gradient.addColorStop(1, 'rgba(96,192,254,0)');
    context!.fillStyle = gradient;
    context!.beginPath();
    context!.ellipse(base.x - 25, base.y + 24, 48, 16, 0, 0, Math.PI * 2);
    context!.fill();

    for (let layer = 0; layer < stack.height; layer++) {
      const point = worldToScreen(stack.u, stack.v, layer, selectedProjection);
      const radius = TILE_RADIUS;
      const side = 9;
      context!.beginPath(); context!.moveTo(point.x + radius, point.y); context!.lineTo(point.x, point.y + radius); context!.lineTo(point.x, point.y + radius + side); context!.lineTo(point.x + radius, point.y + side); context!.closePath(); context!.fillStyle = WHITE_TOWER_COLORS.tileSideDark; context!.fill();
      context!.beginPath(); context!.moveTo(point.x, point.y + radius); context!.lineTo(point.x - radius, point.y); context!.lineTo(point.x - radius, point.y + side); context!.lineTo(point.x, point.y + radius + side); context!.closePath(); context!.fillStyle = WHITE_TOWER_COLORS.tileSideLight; context!.fill();
      drawDiamond(point.x, point.y, radius, WHITE_TOWER_COLORS.tileBevel);
      drawDiamond(point.x, point.y, radius - 4, WHITE_TOWER_COLORS.tileTop);
    }
    if (stack.launchDirection) {
      const point = worldToScreen(stack.u, stack.v, stack.height - 1, selectedProjection);
      drawArrow(point.x, point.y, stack.launchDirection);
    }
    if (view?.selectedStackId === stack.id) {
      const point = worldToScreen(stack.u, stack.v, stack.height - 1, selectedProjection);
      context!.beginPath(); context!.moveTo(point.x, point.y - TILE_RADIUS - 7); context!.lineTo(point.x + TILE_RADIUS + 7, point.y); context!.lineTo(point.x, point.y + TILE_RADIUS + 7); context!.lineTo(point.x - TILE_RADIUS - 7, point.y); context!.closePath();
      context!.strokeStyle = '#3C7EA9'; context!.lineWidth = 3; context!.stroke();
    }
  }

  function setView(nextView: RenderViewState): void {
    if (disposed) return;
    view = nextView;
    projection = createProjection(nextView.level, nextView.level.totalTiles);
    render();
  }

  function resize(nextViewport: RenderViewport): void {
    if (disposed) return;
    viewport = { width: Math.max(1, nextViewport.width), height: Math.max(1, nextViewport.height), pixelRatio: Math.min(Math.max(1, nextViewport.pixelRatio), 2) };
    canvas.width = Math.round(viewport.width * viewport.pixelRatio);
    canvas.height = Math.round(viewport.height * viewport.pixelRatio);
    render();
  }

  function render(): void {
    if (disposed || !context || !viewport.width || !viewport.height) return;
    const scale = Math.min(viewport.width / ARTBOARD.width, viewport.height / ARTBOARD.height);
    const offsetX = (viewport.width - ARTBOARD.width * scale) / 2;
    const offsetY = (viewport.height - ARTBOARD.height * scale) / 2;
    context.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.fillStyle = WHITE_TOWER_COLORS.background;
    context.fillRect(0, 0, viewport.width, viewport.height);
    context.setTransform(viewport.pixelRatio * scale, 0, 0, viewport.pixelRatio * scale, viewport.pixelRatio * offsetX, viewport.pixelRatio * offsetY);
    if (!view) return;
    const activeProjection = projection ?? createProjection(view.level, view.level.totalTiles);
    const occupied = new Set(view.stacks.map(stack => key(stack.u, stack.v)));
    for (const cell of [...view.level.cells].sort((a, b) => a.u + a.v - b.u - b.v)) {
      if (cell.kind === 'blocked') continue;
      const point = worldToScreen(cell.u, cell.v, 0, activeProjection);
      drawDiamond(point.x, point.y, 80, WHITE_TOWER_COLORS.floor, WHITE_TOWER_COLORS.floorSeam);
      if (!occupied.has(key(cell.u, cell.v)) && cell.kind === 'redirect' && cell.direction) drawChevron(point.x, point.y, cell.direction);
    }
    for (const stack of [...view.stacks].sort((a, b) => a.u + a.v - b.u - b.v)) drawStack(stack, activeProjection);
  }

  function pickStack(point: Readonly<{ x: number; y: number }>, activeView: RenderViewState): string | undefined {
    const selectedProjection = projection ?? createProjection(activeView.level, activeView.level.totalTiles);
    return pickVisibleStack(point, activeView.stacks.map(stack => ({ id: stack.id, u: stack.u, v: stack.v, height: stack.height })), selectedProjection);
  }

  return Object.freeze({ setView, resize, render, pickStack, resourceCounts: () => Object.freeze({ geometries: 0, textures: 0, programs: 0, children: 0 }), dispose() { if (!disposed) { disposed = true; view = undefined; } } });
}
