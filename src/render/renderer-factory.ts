import type { WhiteTowerRenderer } from './webgl-renderer.js';
import { createWebGLRenderer } from './webgl-renderer.js';
import { createCanvasRenderer } from './canvas-renderer.js';

export type RendererMode = 'auto' | 'webgl' | '2d' | 'unsupported';
export type RendererFactoryOptions = Readonly<{
  mode?: RendererMode;
  replaceCanvas?: boolean;
  webglFactory?: (canvas: HTMLCanvasElement) => WhiteTowerRenderer;
  canvasFactory?: (canvas: HTMLCanvasElement) => WhiteTowerRenderer;
}>;
export type RendererSelection = Readonly<{ renderer?: WhiteTowerRenderer; canvas: HTMLCanvasElement; mode: RendererMode; supported: boolean; message?: string }>;

function freshCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  return source.cloneNode(false) as HTMLCanvasElement;
}

function unsupportedRenderer(): WhiteTowerRenderer {
  return Object.freeze({ setView() {}, resize() {}, render() {}, pickStack() { return undefined; }, resourceCounts: () => Object.freeze({ geometries: 0, textures: 0, programs: 0, children: 0 }), dispose() {} });
}

export function createRendererFactory(source: HTMLCanvasElement, options: RendererFactoryOptions = {}): RendererSelection {
  const mode = options.mode ?? 'auto';
  const makeWebGL = options.webglFactory ?? createWebGLRenderer;
  const makeCanvas = options.canvasFactory ?? createCanvasRenderer;
  let candidate = options.replaceCanvas ? freshCanvas(source) : source;
  let renderer: WhiteTowerRenderer | undefined;
  let selectedMode: RendererMode = 'unsupported';
  if (mode === 'unsupported') {
    if (options.replaceCanvas) source.parentNode?.replaceChild(candidate, source);
    return Object.freeze({ renderer: unsupportedRenderer(), canvas: candidate, mode, supported: false, message: 'WebGL и Canvas 2D недоступны. Откройте игру в браузере с поддержкой графики.' });
  }

  if (mode !== '2d') {
    try { renderer = makeWebGL(candidate); selectedMode = 'webgl'; }
    catch {
      candidate = freshCanvas(candidate);
    }
  }
  if (!renderer) {
    try { renderer = makeCanvas(candidate); selectedMode = '2d'; }
    catch {
      if (options.replaceCanvas || candidate !== source) source.parentNode?.replaceChild(candidate, source);
      return Object.freeze({ renderer: unsupportedRenderer(), canvas: candidate, mode, supported: false, message: 'Не удалось создать графический режим WebGL или Canvas 2D.' });
    }
  }
  if (options.replaceCanvas || candidate !== source) source.parentNode?.replaceChild(candidate, source);
  return Object.freeze({ renderer, canvas: candidate, mode: selectedMode, supported: true });
}
