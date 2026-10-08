import {
  DoubleSide,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { DIRECTIONS, type Direction } from '../game/directions.js';
import type { Level, Stack } from '../game/model.js';
import { createBevelGeometry, createChevronGeometry, createDiamondGeometry, createDiamondOutlineGeometry, createArrowGeometry, createShadowGeometry, createSideGeometry } from './geometry.js';
import { ARTBOARD, TILE_RADIUS, worldToScreen, createProjection, pickVisibleStack, type Projection } from './projection.js';
import { WHITE_TOWER_COLORS, type RenderStack, type RenderViewState } from './presets.js';

export type RenderViewport = Readonly<{ width: number; height: number; pixelRatio: number }>;
export type RendererResourceCounts = Readonly<{ geometries: number; textures: number; programs: number; children: number }>;

export interface WhiteTowerRenderer {
  setView(view: RenderViewState): void;
  resize(viewport: RenderViewport): void;
  render(): void;
  pickStack(point: Readonly<{ x: number; y: number }>, view: RenderViewState): string | undefined;
  resourceCounts(): RendererResourceCounts;
  dispose(): void;
}

const MATERIAL_OPTIONS = { depthTest: false, depthWrite: false, side: DoubleSide } as const;

function pointKey(u: number, v: number): string { return `${u},${v}`; }

function pixelPoint(u: number, v: number, height: number, projection: Projection) {
  const point = worldToScreen(u, v, height, projection);
  return { x: point.x - ARTBOARD.width / 2, y: ARTBOARD.height / 2 - point.y };
}

function createMaterials() {
  return {
    tileTop: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.tileTop, ...MATERIAL_OPTIONS }),
    tileBevel: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.tileBevel, ...MATERIAL_OPTIONS }),
    sideLight: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.tileSideLight, ...MATERIAL_OPTIONS }),
    sideDark: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.tileSideDark, ...MATERIAL_OPTIONS }),
    floor: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.floor, ...MATERIAL_OPTIONS }),
    arrow: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.arrow, ...MATERIAL_OPTIONS }),
    chevron: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.chevron, ...MATERIAL_OPTIONS }),
    selection: new MeshBasicMaterial({ color: '#3C7EA9', ...MATERIAL_OPTIONS }),
    seam: new MeshBasicMaterial({ color: WHITE_TOWER_COLORS.floorSeam, ...MATERIAL_OPTIONS }),
    // Pre-composited blue keeps shadows in the opaque ordering pass, behind tile faces.
    shadow: new MeshBasicMaterial({ color: '#FFFFFF', vertexColors: true, ...MATERIAL_OPTIONS }),
  };
}

export function createWebGLRenderer(canvas: HTMLCanvasElement): WhiteTowerRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(WHITE_TOWER_COLORS.background, 1);
  renderer.autoClear = false;

  const scene = new Scene();
  const camera = new OrthographicCamera(-360, 360, 640, -640, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);

  const materials = createMaterials();
  const geometry = {
    floor: createDiamondGeometry(80),
    floorOutline: createDiamondOutlineGeometry(78),
    tileTop: createDiamondGeometry(TILE_RADIUS - 4),
    tileBevel: createBevelGeometry(TILE_RADIUS, 4),
    tileSide: createSideGeometry(TILE_RADIUS, 9),
    selection: createDiamondOutlineGeometry(TILE_RADIUS + 7),
    shadow: createShadowGeometry(),
    arrows: Object.fromEntries(DIRECTIONS.map(direction => [direction, createArrowGeometry(direction)])) as Record<Direction, ReturnType<typeof createArrowGeometry>>,
    chevrons: Object.fromEntries(DIRECTIONS.map(direction => [direction, createChevronGeometry(direction)])) as Record<Direction, ReturnType<typeof createChevronGeometry>>,
  };
  const viewLayer = new Scene();
  scene.add(viewLayer);
  let viewport: RenderViewport = { width: 1, height: 1, pixelRatio: 1 };
  let projection: Projection | undefined;
  let view: RenderViewState | undefined;
  let disposed = false;

  function addMesh(geo: typeof geometry.floor, material: MeshBasicMaterial | MeshBasicMaterial[], position: { x: number; y: number; z: number }, order: number, scaleX = 1, scaleY = 1) {
    const mesh = new Mesh(geo, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(scaleX, scaleY, 1);
    mesh.renderOrder = order;
    viewLayer.add(mesh);
    return mesh;
  }

  function addStack(stack: RenderStack, level: Level, selectedProjection: Projection, baseOrder: number): number {
    const base = pixelPoint(stack.u, stack.v, 0, selectedProjection);
    const depth = (stack.u + stack.v + 1000) * 0.00001;
    const shadow = addMesh(geometry.shadow, materials.shadow, { x: base.x - 25, y: base.y + 24, z: depth + 0.001 }, baseOrder);
    shadow.scale.set(48 + Math.min(stack.height, 14) * 1.2, 16 + Math.min(stack.height, 14) * 0.6, 1);

    let order = baseOrder + 1;
    for (let layer = 0; layer < Math.ceil(stack.height); layer++) {
      const fraction = Math.min(1, stack.height - layer);
      const point = pixelPoint(stack.u, stack.v, layer + (layer === Math.floor(stack.height) ? (stack.lift ?? 0) : 0), selectedProjection);
      point.x += (stack.tilt ?? 0) * layer * 42;
      point.y -= (stack.tilt ?? 0) * layer * 22;
      const layerDepth = depth + 0.01 + layer * 0.00001;
      const popScale = layer === Math.floor(stack.height) && stack.height % 1 > 0 ? Math.max(0.08, fraction) : 1;
      addMesh(geometry.tileSide, [materials.sideLight, materials.sideDark], { x: point.x, y: point.y, z: layerDepth }, order++, 1, popScale);
      addMesh(geometry.tileBevel, materials.tileBevel, { x: point.x, y: point.y, z: layerDepth + 0.001 }, order++, 1, popScale);
      addMesh(geometry.tileTop, materials.tileTop, { x: point.x, y: point.y, z: layerDepth + 0.002 }, order++, 1, popScale);
    }
    const direction = stack.launchDirection;
    if (direction) {
      const top = pixelPoint(stack.u, stack.v, stack.height - 1 + (stack.lift ?? 0), selectedProjection);
      top.x += (stack.tilt ?? 0) * Math.max(0, stack.height - 1) * 42;
      top.y -= (stack.tilt ?? 0) * Math.max(0, stack.height - 1) * 22;
      addMesh(geometry.arrows[direction], materials.arrow, { x: top.x, y: top.y, z: depth + 0.03 + stack.height * 0.00001 }, order++).rotation.z = stack.turnRotation ?? 0;
    }
    return order + Math.max(1, level.cells.length);
  }

  function setView(nextView: RenderViewState): void {
    if (disposed) return;
    viewLayer.clear();
    view = nextView;
    projection = createProjection(nextView.level, nextView.level.totalTiles);
    const occupied = new Set(nextView.stacks.map(stack => pointKey(stack.u, stack.v)));
    const sortedCells = [...nextView.level.cells].sort((a, b) => a.u + a.v - (b.u + b.v) || a.u - b.u || a.v - b.v);
    let order = 1;
    for (const cell of sortedCells) {
      if (cell.kind === 'blocked') continue;
      const point = pixelPoint(cell.u, cell.v, 0, projection);
      const depth = (cell.u + cell.v + 1000) * 0.00001;
      addMesh(geometry.floor, materials.floor, { x: point.x, y: point.y, z: depth }, order++);
      const outline = new LineSegments(geometry.floorOutline, materials.seam);
      outline.position.set(point.x, point.y, depth + 0.001);
      outline.renderOrder = order++;
      viewLayer.add(outline);
      if (!occupied.has(pointKey(cell.u, cell.v)) && cell.kind === 'redirect' && cell.direction) {
        addMesh(geometry.chevrons[cell.direction], materials.chevron, { x: point.x, y: point.y, z: depth + 0.002 }, order++);
      }
    }
    const sortedStacks = [...nextView.stacks].sort((a, b) => a.u + a.v - (b.u + b.v) || a.u - b.u || a.v - b.v);
    for (const stack of sortedStacks) {
      order = addStack(stack, nextView.level, projection, order + 2);
      if (stack.id === nextView.selectedStackId) {
        const top = pixelPoint(stack.u, stack.v, stack.height - 1 + (stack.lift ?? 0), projection);
        const outline = new LineSegments(geometry.selection, materials.selection);
        outline.position.set(top.x, top.y, 0.08 + (stack.u + stack.v) * 0.00001);
        outline.renderOrder = order++;
        viewLayer.add(outline);
      }
    }
    render();
  }

  function resize(nextViewport: RenderViewport): void {
    if (disposed) return;
    viewport = { width: Math.max(1, nextViewport.width), height: Math.max(1, nextViewport.height), pixelRatio: Math.min(Math.max(1, nextViewport.pixelRatio), 2) };
    renderer.setPixelRatio(viewport.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    render();
  }

  function render(): void {
    if (disposed || viewport.width <= 0 || viewport.height <= 0) return;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, viewport.width, viewport.height);
    renderer.clear(true, true, true);
    const scale = Math.min(viewport.width / ARTBOARD.width, viewport.height / ARTBOARD.height);
    const width = ARTBOARD.width * scale;
    const height = ARTBOARD.height * scale;
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, width, height);
    renderer.setViewport(x, y, width, height);
    if (view) renderer.render(scene, camera);
    renderer.setScissorTest(false);
  }

  function pickStack(point: Readonly<{ x: number; y: number }>, activeView: RenderViewState): string | undefined {
    if (!projection) projection = createProjection(activeView.level, activeView.level.totalTiles);
    return pickVisibleStack(point, activeView.stacks, projection);
  }

  function resourceCounts(): RendererResourceCounts {
    return Object.freeze({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, children: viewLayer.children.length });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    viewLayer.clear();
    geometry.floor.dispose();
    geometry.floorOutline.dispose();
    geometry.tileTop.dispose();
    geometry.tileBevel.dispose();
    geometry.tileSide.dispose();
    geometry.selection.dispose();
    geometry.shadow.dispose();
    Object.values(geometry.arrows).forEach(item => item.dispose());
    Object.values(geometry.chevrons).forEach(item => item.dispose());
    Object.values(materials).forEach(material => material.dispose());
    renderer.dispose();
  }

  return Object.freeze({ setView, resize, render, pickStack, resourceCounts, dispose });
}
