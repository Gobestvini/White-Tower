# Accessibility and viewport review

Date: 2026-10-09. Automated checks ran in headless Chromium on the local Vite app (`127.0.0.1:5173`).

The browser matrix covered 320×568, 360×640, 390×844, 412×915, 768×1024, 1024×768, 1366×768, and 1920×1080. At each size the test checked horizontal overflow, scene bounds, a reachable 44 CSS px minimum Undo target, selected-stack hit testing, and Settings card bounds. The game frame remains portrait and scales uniformly. The implementation uses `100dvh` and safe-area env values, but the browser test does not reproduce real dynamic browser bars or device cutouts.

The keyboard scenarios solved A_line, C_diamond, and D_ring using arrow navigation and Enter, then exercised Undo and Settings. The Canvas points to a concise description containing level, gathered count, active arrow coordinates, stack height, direction, and selected arrow. Its text changes only when the game state or keyboard selection changes; it is not tied to animation frames. Action announcements are localized. The test verified the high-contrast setting applies and survives save/reload; reduced-motion remains wired to animation timing and CSS transitions.

No physical phone, tablet split-view, or screen reader was available. Speech clarity and focus recovery during real Undo, victory, and menu flows remain for owner acceptance. The automated tests do not justify marking that manual criterion complete.
