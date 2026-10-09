# Карта проекта

| Путь | Назначение |
| --- | --- |
| src/main.js | Canvas, RAF, resize, visibility, пауза/reset, HMR dispose |
| src/ui/hud.ts, victory.ts, settings.ts, level-select.ts, i18n.ts, accessibility.ts, hint.ts, tutorial.ts | DOM HUD, двуязычные Settings/level select, счётчик, Undo/Restart, финал кампании, описание поля для screen reader, high contrast, подсказка и начальное обучение |
| src/loop.js / createStepper | Шаг 1/60 с, максимум 8 шагов кадра, dropped time, alpha |
| src/input.js / createInput | Удерживаемые event.code клавиши, blur/reset/dispose |
| src/input/pointer.ts, game-actions.ts | Pointer цель и CSS-порог; keyboard selection и controller intents |
| src/scene.js / createScene | Связывает controller, проигрыватель временных поз и renderer; не владеет правилами |
| src/presentation/animation.ts, timings.ts | Кадрово-независимый маршрут движения, слияния, поворота и остановки; пауза/отмена, без изменения committed state |
| index.html, src/style.css | Оболочка приложения и адаптивная сцена |
| tsconfig.json | Строгая проверка TypeScript runtime, тестов и инструментов |
| src/game/ | Правила, модель уровня, симулятор, поиск решения, контроллер и сервис доказанных подсказок |
| src/audio/audio.ts, events.ts | Gesture-gated Web Audio, тихие синтезированные эффекты, volume/voice limits, hidden/dispose lifecycle |
| src/storage/store.ts, save-schema.ts | Устойчивое локальное сохранение: IndexedDB → localStorage → память; проверка версии и состояния |
| src/render/webgl-renderer.ts | Основной Three.js WebGL renderer, процедурные плитки и владение GPU ресурсами |
| src/render/canvas-renderer.ts | Совместимый 2D renderer с тем же view state, projection и hit-test |
| src/render/renderer-factory.ts | WebGL2 → Canvas 2D fallback и режим Unsupported; QA-переключение без сброса state |
| src/render/projection.ts, geometry.ts, presets.ts | Единая проекция/inverse, CSS hit-test/occlusion, геометрия, palette и временные позы стека |
| tests/game-*.test.js | Поведенческие проверки игровых систем; `game-animation.test.js` покрывает FPS, паузу и отмену |
| tests/loop.test.js, tests/input.test.js | Частоты кадров, stalls, ввод и очистка |
| tools/telegram/knowledge.js | Память, актуальность хэшей, ограничение контекста |
| tools/telegram/verify.js | Тесты, TypeScript, сборка, логи и проверяемая квитанция |
| tools/telegram/economy.js | Инструкции экономии, JSONL usage, учёт кэша |
| tools/browser-check.cjs | Desktop/mobile layout, pointer/keyboard, реальное проигрывание маршрутов, пауза в ходе, fallback/state continuity, ошибки |
| docs/knowledge/README.md | Выбор справочника по теме и правила сохранения знаний |
| docs/knowledge/white-tower/README.md | Материалы White Tower из исходного диалога: видео, полный GDD, 12 кадров и примеры уровней |
| docs/knowledge/white-tower/import-manifest.json | Происхождение, размеры и SHA-256 перенесённых материалов |
| docs/ASSETS.md | Происхождение, права, версия и назначение UI-графики и системного шрифта |
| docs/reviews/visual-slice.md, docs/reviews/visual/, docs/reviews/vertical-slice.md | Evidence визуального среза TASK-0013 и двенадцатиуровневой интеграции |
| docs/content/reference-levels.md, level-reviews.md | Provisional реконструкции 1–11, решения и ручной протокол уровней 1–12 |
| docs/content/authoring.md, tools/level-editor/ | Локальный отдельный редактор контента и четыре стадии его ручного допуска |
| docs/content/campaign.md, public/content/catalog.json, public/content/levels/ | 120 уровней кампании; новые дизайны помечены provisional и снабжены таблицей решений/статуса проверки |
| tools/validate-levels.mjs | CLI-проверка каталога, hashes, schema, решения и циклических запусков |
| public/sw.js, public/manifest.webmanifest | Production offline cache для shell/assets/120 уровней; обновления по SW lifecycle |
| tools/pwa-check.cjs, tools/content-loading-check.cjs | Production offline reload и сохранение стабильного уровня при сетевом отказе Next |
| tools/campaign-check.cjs, tools/lifecycle-check.cjs, tools/performance-check.cjs | Сквозной browser прогон кампании, WebGL restore/fallback и сетевые измерения preview |
| docs/tasks/INDEX.md, docs/tasks/PLAN.md | Очередь из 34 заданий на полную реализацию White Tower, этапы и покрытие GDD |
| docs/tasks/baseline.json | Ревизия и хэши локальных входов, проверенных при подготовке очереди |
| docs/knowledge/game-architecture.md | Контракты и владельцы при расширении каркаса |
| docs/knowledge/threejs.md | Справочник для добавления 3D renderer; Three.js пока не подключён |
| docs/knowledge/debug-performance.md, assets-and-ui.md | Диагностика, бюджеты, контент и интерфейс |
| docs/knowledge/sources.md | Версии, происхождение и степень проверки знаний |

Рабочая директория всех команд — корень шаблона. `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm check:full`, `pnpm context -- "тема"`.

Порядок: ввод → fixed update → render(alpha). При добавлении движения храни previous/current и интерполируй только графику. Обновляй карту при изменении владельцев подсистем; не записывай каждый внутренний helper.
