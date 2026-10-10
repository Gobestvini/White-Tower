# Casual UI integration — 10 October 2026

The ten assembled concept screens now supply the live game's visual language. The implementation uses individual transparent elements and clean scenery, with semantic buttons, selects, sliders and checkboxes. No flattened screen replaces interaction.

| Concept | Runtime behavior |
| --- | --- |
| 01 gameplay | Logo, settings/restart, live gathered/total counter, current level, Undo and direct Hint action; live board |
| 02 tutorial | Tutorial scenery and localized instruction; the real first move completes onboarding |
| 03 hint | Hint scenery, localized status and actual highlighted stack; solver behavior preserved |
| 04 levels | Five-column grid, 30 levels per page, four pages; locks, completion and selected level use saved progress |
| 05 settings | Transparent panel and button art; working language, sound, volume, motion, contrast, graphics, import/export and return controls |
| 06 victory | Ribbon and scenery around the actual winning board; Next and Undo remain functional |
| 07 campaign | Final ribbon and decorative tower/island; choose levels opens the page containing the selected level |
| 08 reset | Separate panel/icon and live text; background controls become inert, Tab stays within confirmation, Cancel preserves progress |
| 09 recovery | Warning card and storage icon for persistence/recovery notices; controls remain accessible by scrolling |
| 10 service states | Loading tower and indeterminate progress, content/graphics error illustration and Retry; failed Next preserves victory and offers Retry/Choose level; deadlock notice retains Undo |

## Verification

`pnpm check:full` passed: unit tests, TypeScript, level validation and production build. New behavioral tests cover paging all 120 levels, locks, selected-level paging, locale updates and completed cells. Service-worker tests cover artwork for unopened screens, rollback after incomplete installation, and rejection of invalid artwork URLs. The existing content-loading browser script was updated for the explicit Retry action.

Browser checks used the actual app through the in-app browser, with separate local origins for fixtures:

- EN/RU controls, high contrast and real first-level keyboard play through victory.
- Direct Hint produces the solver instruction. Settings graphics preference and the renderer's normal lifecycle remain connected.
- Reset Cancel and Tab wrapping were checked without clearing progress.
- Page 1 → page 2 → page 1, locked cells, and the final 91–120 page were checked. Final-campaign presentation was exercised with a valid imported fixture produced by replaying level 120's known solution; this is a fixture check, not a manual playthrough of 120 levels.
- A delayed catalog response visibly showed loading. One-shot HTTP 503 fixtures tested initial error → Retry → ready, and failed Next → unchanged won level 1 → Retry → level 2.
- An invalid schema in an isolated IndexedDB fixture displayed storage recovery. `?renderer=unsupported` displayed the graphics error state.
- Actual iframe viewports 390 × 844 (WebGL), 320 × 568 (Canvas 2D), and 844 × 390 (Canvas 2D) checked panel bounds and visible headings. All panels fit within the game area; short portrait settings scroll, while landscape settings use two columns and fit without scrolling. These are browser viewport checks, not physical phones.
- The production preview loaded the live game and artwork successfully. Offline installation logic and the complete emitted image manifest were checked automatically; a browser-level offline reload was not exercised in this run.

Screenshots: [game](casual/gameplay.png), [settings](casual/settings.png), [levels](casual/levels.png).

## Fidelity and boundaries

The clean backgrounds and blank panels were reconstructed previously and are not pixel-identical to the mockups. Dynamic labels, counters and level numbers are live text. Buttons with baked Russian text are used for matching Russian actions; English and high contrast use native text on corresponding CSS surfaces. Panels reflow for usable hit areas and scrolling. The level renderer retains its existing geometry and hit testing; only its clear/background becomes transparent so scenery shows beneath it. This does not turn decorative concept boards into interactive geometry or add a new 3D art pipeline.

No production deployment, Telegram launch or physical-device acceptance was performed. Campaign content and gameplay rules are unchanged.
