# Runtime asset register

| Asset | Source / generator | Version | Use | Runtime owner / release |
| --- | --- | --- | --- | --- |
| White tile top, bevel band, and side faces | Procedural BufferGeometry in `src/render/geometry.ts`; no external source or export | App source, TASK-0008 | One top and two exposed faces per tile layer; shared geometry/material instances | `src/render/webgl-renderer.ts`; disposed once with renderer |
| Yellow floor cell and seams | Procedural diamond geometry and outline in `src/render/geometry.ts`; no external source or export | App source, TASK-0008 | Floor and redirect cells | `src/render/webgl-renderer.ts`; disposed once with renderer |
| Orange launch arrow | Procedural directional geometry generated from `src/game/directions.ts` in `src/render/geometry.ts` | App source, TASK-0008 | Active stack top; constant screen size at every stack height | `src/render/webgl-renderer.ts`; one shared geometry per direction |
| White floor chevrons | Procedural directional geometry generated from `src/game/directions.ts` in `src/render/geometry.ts` | App source, TASK-0008 | Visible redirect floor cells | `src/render/webgl-renderer.ts`; one shared geometry per direction |
| Blue stack shadow | Procedural radial vertex-color gradient in `src/render/geometry.ts`, pre-composited against artboard blue | App source, TASK-0008 | Soft-style offset under stacks | `src/render/webgl-renderer.ts`; shared geometry/material |
| Level data | Project-owned JSON in `public/content/levels/`; provenance and confidence in `docs/content/reference-levels.md` | Catalog `1.0.0` | Reference campaign | Content loader; data is not a visual texture |
| Settings, Restart, Undo, Next | Project-authored inline SVG geometry in `src/ui/hud.ts` and `src/ui/victory.ts`; no raster export | App source, TASK-0012; no external icon library | Interactive HUD controls | DOM HUD; hit areas are at least 44 CSS px |
| Victory ribbon, shade, and button surfaces | Project-authored CSS in `src/style.css`; text markup in `src/ui/victory.ts`; no external textures/images | App source, TASK-0012 | Win state | DOM overlay; visual calibration remains provisional until TASK-0013 |
| Interface font | Platform system sans-serif stack: `system-ui`, `Segoe UI`, `Arial`; configured in `src/style.css`; no font file is bundled | Platform-provided font versions | EN/RU interface text and digits using platform fallback | Browser/system fonts under platform licenses; visual match remains provisional until TASK-0013 |
| R01–R12 reference frames | User-provided source video; copies in `docs/knowledge/white-tower/references/`; provenance in `docs/knowledge/white-tower/import-manifest.json` | Source video timestamps are recorded in GDD | Internal visual comparison only; not shipped in client build | Reference material remains under source owner's rights |

Sizes, pivots, collision shapes, and material slots do not apply to the DOM interface. All GPU geometries and materials are owned by the WebGL renderer and disposed by its `dispose()` method.
