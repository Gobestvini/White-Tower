# Runtime asset register

| Asset | Source / generator | Version | Use | Runtime owner / release |
| --- | --- | --- | --- | --- |
| White tile top, bevel band, and side faces | Procedural BufferGeometry in `src/render/geometry.ts`; no external source or export | App source, TASK-0008 | One top and two exposed faces per tile layer; shared geometry/material instances | `src/render/webgl-renderer.ts`; disposed once with renderer |
| Yellow floor cell and seams | Procedural diamond geometry and outline in `src/render/geometry.ts`; no external source or export | App source, TASK-0008 | Floor and redirect cells | `src/render/webgl-renderer.ts`; disposed once with renderer |
| Orange launch arrow | Procedural directional geometry generated from `src/game/directions.ts` in `src/render/geometry.ts` | App source, TASK-0008 | Active stack top; constant screen size at every stack height | `src/render/webgl-renderer.ts`; one shared geometry per direction |
| White floor chevrons | Procedural directional geometry generated from `src/game/directions.ts` in `src/render/geometry.ts` | App source, TASK-0008 | Visible redirect floor cells | `src/render/webgl-renderer.ts`; one shared geometry per direction |
| Blue stack shadow | Procedural radial vertex-color gradient in `src/render/geometry.ts`, pre-composited against artboard blue | App source, TASK-0008 | Soft-style offset under stacks | `src/render/webgl-renderer.ts`; shared geometry/material |
| Level data | Project-owned JSON in `public/content/levels/`; provenance and confidence in `docs/content/reference-levels.md` | Catalog `1.0.0` | Reference campaign | Content loader; data is not a visual texture |

No video frames or third-party visual assets are included in the runtime bundle. All GPU geometries and materials are owned by the WebGL renderer and disposed by its `dispose()` method.
