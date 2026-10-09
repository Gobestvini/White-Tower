# Vertical slice: levels 1–12

Campaign levels 13–120 and their solver evidence are listed in [campaign.md](campaign.md). New campaign layouts are provisional and await human play/readability review; the table keeps manual status separate from automated solution replay.

Recorded 2026-10-09 for TASK-0019. Levels 1–11 are the reference reconstructions documented in [reference-levels.md](reference-levels.md); level 12 is original content approved after the owner's acceptance of TASK-0013.

## Level 12: The Turning Path

Six single tiles form a short L-shaped route. The active stack starts at `(0,0)` and moves `SE`. Cell `(2,0)` redirects the route `SW`; the path then collects `(2,1)`, `(2,2)`, and `(2,3)`. The one-move known solution is `[{"u":0,"v":0}]`; the expected final stack height is 6. This introduces a visible floor redirect without changing rules or adding a new mechanic. The catalog entry is SHA-256 checked.

`pnpm check:full` validates the schema, loads the catalog, checks all twelve entries and checksums, and replays each known solution to one six-through-fourteen tile stack. `pnpm test:browser` plays the known solution for level 11, uses NEXT to load level 12, solves the final level, and verifies that the final screen offers level selection rather than a nonexistent NEXT. It repeats that path in WebGL and Canvas 2D. Screenshots: `../reviews/vertical-slice-level12-webgl.png` and `../reviews/vertical-slice-level12-2d.png`.

## Manual play protocol

Automated replay is evidence for simulator/content correctness, not a manual playthrough. For each of levels 1–12, open its numbered level on desktop and a real narrow-screen phone, read the visible direction, play the saved known solution by hand, confirm the stack count reaches `N/N`, then use Undo after victory and Restart. On level 11, continue with NEXT and confirm level 12; finish 12 and confirm the campaign end screen. Record device, renderer, language, completion, and any confusion below.

| Levels | Automated solution replay | Manual desktop | Real phone |
| --- | --- | --- | --- |
| 1–11 | Passed by catalog solver/replay tests | Pending owner playthrough | Pending owner playthrough |
| 12 | Passed by catalog solver/replay tests and browser transition in both renderers | Pending owner playthrough | Pending owner playthrough |

The build and browser automation do not replace the manual protocol. The vertical slice remains `review` until the remaining manual checks are accepted.
