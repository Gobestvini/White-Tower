# ADR: WebGL renderer and coordinate contracts

- Status: accepted for implementation, 2026-10-08
- Scope: technical path; artistic acceptance remains TASK-0013.

## Decision

Use Three.js `WebGLRenderer` on WebGL2 as the primary renderer. Use Canvas 2D as a compatibility fallback behind the same view-state contract. Keep game rules and the fixed-step loop independent of either renderer. The renderer consumes immutable snapshots and must not mutate model state. Do not add a physics engine.

Three.js was chosen over a custom WebGL2 renderer because the small comparison shows that the custom path saves draw calls but requires project-owned shader compilation, buffer management, batching, and context cleanup. The scene is a small static board; a library's scene/camera/resource lifecycle is more valuable than shaving a few calls. Use shared geometry/materials or instancing in the actual implementation and measure again at TASK-0031.

## Evidence and limits

`tools/renderer-spike/` renders the four-tile R01 route and a fourteen-layer tower in Three.js, custom WebGL2, and Canvas 2D on the same 720×1280 artboard and coordinate transform. Browser inspection confirmed WebGL2 contexts and the same route/tower silhouette; the canvas comparison was visually checked during the task. The Three.js prototype uses 61 mesh submissions (meshes are intentionally unbatched); the raw WebGL2 version submits five colour batches. This is a prototype comparison, not an optimized game benchmark.

The comparison app's production JS is 519,671 bytes minified and 131,080 bytes gzip; it includes all three candidates, so this is a conservative combined spike measurement rather than a fair per-renderer bundle measure. It fits the GDD's 3 MB initial JS budget. TASK-0031 measures the actual production renderer. Exact dependency selected: `three@0.186.0`, recorded in package.json/lockfile. It is pinned exactly so upgrades are deliberate. Three's renderer requires WebGL2; `src/render/renderer-factory.ts` detects a failed WebGL constructor, retries Canvas 2D on a fresh canvas, and reports Unsupported if both paths fail. The fallback shares projection, view state and hit testing. QA can switch renderers in a stable controller phase while retaining state/history; the application keeps a single RAF.

The prototype matches the board footprint and layer count but does not reproduce rounded bevels, shadow shape, exact HUD, or calibrated camera. TASK-0008 uses a shared 2D projection contract and procedural bevel/side geometry; provisional coordinates approved for TASK-0007 remain subject to TASK-0013 artistic acceptance. The GDD's initial projection equation uses screenY increasing with `u+v`, while R01's route rises toward the upper-right. The renderer uses `screenY = originY - (u+v)*b - z*c` to match the observed screen orientation.

## Contracts

```ts
type Vec2 = Readonly<{ x: number; y: number }>;
type StackView = Readonly<{ id: string; x: number; y: number; height: number; direction: 0 | 1 | 2 | 3 }>;
type ViewState = Readonly<{ revision: number; stacks: readonly StackView[]; selectedStackId?: string }>;
type Viewport = Readonly<{ width: number; height: number; pixelRatio: number }>;
interface Renderer {
  render(viewState: ViewState, viewport: Viewport): void;
  resize(viewport: Viewport): void;
  pickStack(point: Vec2, viewState: ViewState, viewport: Viewport): string | undefined;
  dispose(): void;
}
```

The simulation owns integer board coordinates, heights, directions, move count, and stable state. It emits a new immutable `ViewState` revision after a committed logical action. The renderer owns GPU/Canvas resources, projection, visual interpolation, and hit testing; it may read snapshots but cannot modify them. World coordinates are tile units, height is layer count, direction is a quarter-turn enum. Pixel coordinates are CSS pixels; drawing-buffer scaling uses bounded DPR. `resize` changes backing storage/camera without changing game state. `pickStack` returns stable ID only; controller validates whether the action is legal.

Module boundaries:

- `validateLevel(raw): Result<Level, LevelError[]>`; `createInitialState(level): GameState` owns validated content and initial immutable state.
- `simulateMove(state, stackId): MoveResult` is pure and deterministic; it returns either a new state, trace, and outcome or a typed rejection. It has no DOM or renderer dependency.
- `createGameController({ level, onSnapshot })` owns committed state, pending input, Undo history, Restart, and generation ID. Animation completion cannot commit game rules a second time.
- `solve(level, options, signal)` runs in a Worker and reports bounded progress/result tagged with generation ID; stale results are ignored.
- `createAnimationPlayer(renderer)` owns only transient poses and cancellation tokens, never stable state.
- `createStore(storage)` persists versioned completed progress/settings, with migrations isolated from active-attempt snapshots.
- `createAudio()` owns lazily-created audio context and effect voices; disposal releases all resources.

`GameState`/solver contracts are refined in their tasks when the model is concrete. Keep `revision` for view invalidation and `generationId` for reset/level changes and asynchronous solver/animation cancellation. A committed logical outcome is authoritative; the current visual pose is transient and is not saved.

## References

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) documents WebGL2 requirements.
- [Three.js r186 release](https://github.com/mrdoob/three.js/releases) is the selected release line; project pin is 0.186.0.
- [Three.js disposal guide](https://threejs.org/manual/en/how-to-dispose-of-objects.html) informs explicit resource cleanup.
- Local comparison: `tools/renderer-spike/`; source frame: `docs/knowledge/white-tower/references/ref_0s.png`, `ref_33s.png`.
