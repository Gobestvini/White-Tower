# White Tower

White Tower is a browser puzzle about guiding moving stacks across a tiled board. The project includes a WebGL renderer with Canvas 2D fallback, keyboard/touch controls, Undo, hints, local progress, bilingual settings, and a 120-level campaign. Campaign levels 13–120 are provisional candidates awaiting human play and readability review; see [campaign report](docs/content/campaign.md) and [manual review protocol](docs/content/level-reviews.md).

The game now uses the Facebook casual concept artwork across its live HUD, tutorial, hints, settings, level selection, victory, campaign completion, reset confirmation, storage recovery and service states. Counters, levels and preferences remain dynamic. See the [integration review](docs/reviews/casual-ui.md) for scope and verification.

## Run locally

Play online: **https://gobestvini.github.io/White-Tower/**.

GitHub Actions publishes `main` to GitHub Pages after the full checks pass. The
Pages source is GitHub Actions (`.github/workflows/pages.yml`). For a matching
local production build, run `pnpm build --base /White-Tower/` and open
`http://127.0.0.1:4173/White-Tower/` with `pnpm exec vite preview --base /White-Tower/ --port 4173`.

Requires Node.js 22.12 or later and pnpm.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL shown by Vite. To compare renderers, add `?renderer=2d` or `?renderer=webgl`. The internal editor is available only in development at `/tools/level-editor/`.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm validate:levels
pnpm check:full
```

With Playwright installed, run `pnpm test:campaign` and `pnpm test:browser` against `pnpm dev`. The production service-worker/offline scenario uses `pnpm build`, `pnpm preview -- --port 4173`, then `pnpm test:pwa` with `GAME_BASE_URL=http://127.0.0.1:4173`. `pnpm test:lifecycle` exercises WebGL context loss and Canvas fallback where `WEBGL_lose_context` is available.

Browser viewport emulation does not count as physical-device testing. Before release, play the levels on desktop and a real touch phone, then record readability, target sizes, route time, hint response, and any confusing branches in the campaign report.

## Project documents

- [Project map](docs/PROJECT.md)
- [Task index and status](docs/tasks/INDEX.md)
- [Campaign content and acceptance status](docs/content/campaign.md)
- [Level review protocol](docs/content/level-reviews.md)
- [Internal authoring guide](docs/content/authoring.md)
- [GDD and source material](docs/knowledge/white-tower/README.md)
