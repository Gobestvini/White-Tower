# Карта проекта

| Путь | Назначение |
| --- | --- |
| src/main.js | Canvas, RAF, resize, visibility, пауза/reset, HMR dispose |
| src/loop.js / createStepper | Шаг 1/60 с, максимум 8 шагов кадра, dropped time, alpha |
| src/input.js / createInput | Клавиатура event.code, blur/reset/dispose |
| src/scene.js / createScene | Пустая точка расширения: update/render/reset/snapshot/dispose |
| index.html, src/style.css | Оболочка приложения и адаптивная сцена |
| tsconfig.json | Строгая проверка TypeScript runtime, тестов и инструментов |
| src/game/ | Правила, модель уровня и контроллер (в последующих задачах) |
| src/render/ | Выбранный WebGL renderer, общая проекция и Canvas fallback (в последующих задачах) |
| tests/game-*.test.js | Поведенческие проверки игровых систем, запускаются вместе с общей suite |
| tests/loop.test.js, tests/input.test.js | Частоты кадров, stalls, ввод и очистка |
| tools/telegram/knowledge.js | Память, актуальность хэшей, ограничение контекста |
| tools/telegram/verify.js | Тесты, TypeScript, сборка, логи и проверяемая квитанция |
| tools/telegram/economy.js | Инструкции экономии, JSONL usage, учёт кэша |
| tools/browser-check.cjs | Desktop/mobile layout, pause/reset, ввод, ошибки |
| docs/knowledge/README.md | Выбор справочника по теме и правила сохранения знаний |
| docs/knowledge/white-tower/README.md | Материалы White Tower из исходного диалога: видео, полный GDD, 12 кадров и примеры уровней |
| docs/knowledge/white-tower/import-manifest.json | Происхождение, размеры и SHA-256 перенесённых материалов |
| docs/tasks/INDEX.md, docs/tasks/PLAN.md | Очередь из 34 заданий на полную реализацию White Tower, этапы и покрытие GDD |
| docs/tasks/baseline.json | Ревизия и хэши локальных входов, проверенных при подготовке очереди |
| docs/knowledge/game-architecture.md | Контракты и владельцы при расширении каркаса |
| docs/knowledge/threejs.md | Справочник для добавления 3D renderer; Three.js пока не подключён |
| docs/knowledge/debug-performance.md, assets-and-ui.md | Диагностика, бюджеты, контент и интерфейс |
| docs/knowledge/sources.md | Версии, происхождение и степень проверки знаний |

Рабочая директория всех команд — корень шаблона. `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm check:full`, `pnpm context -- "тема"`.

Порядок: ввод → fixed update → render(alpha). При добавлении движения храни previous/current и интерполируй только графику. Обновляй карту при изменении владельцев подсистем; не записывай каждый внутренний helper.
