# Очередь White Tower

Подготовлено 34 задания для полной реализации GDD. [План, этапы и покрытие GDD](PLAN.md). TASK-0001–0005 завершены; TASK-0006 доступна по зависимостям, последующие ожидают предпосылок. Статус в файле задачи — источник истины.

| Задача | Статус | Приоритет | Зависимости | Исполнитель |
| --- | --- | --- | --- | --- |
| [TASK-0001 Подготовить воспроизводимую основу White Tower](TASK-0001-project-foundation.md) | done | high | нет | средняя |
| [TASK-0002 Выбрать рендер и зафиксировать контракты подсистем](TASK-0002-renderer-decision.md) | done | high | TASK-0001 | сильная |
| [TASK-0003 Реализовать модель уровня и проверку JSON](TASK-0003-level-model.md) | done | normal | TASK-0001 | средняя |
| [TASK-0004 Реализовать расчёт полного хода и защиту от циклов](TASK-0004-move-simulator.md) | done | high | TASK-0003 | сильная |
| [TASK-0005 Связать игровые состояния с Undo и Restart](TASK-0005-game-controller-undo.md) | done | normal | TASK-0004 | средняя |
| [TASK-0006 Реализовать решатель в Worker с ограниченным бюджетом](TASK-0006-solver-worker.md) | ready | normal | TASK-0004 | сильная |
| [TASK-0007 Восстановить одиннадцать уровней из видео](TASK-0007-reference-levels.md) | draft | normal | TASK-0002, TASK-0004, TASK-0006 | сильная |
| [TASK-0008 Отрисовать эталонное поле в WebGL](TASK-0008-webgl-scene.md) | draft | normal | TASK-0002, TASK-0003, TASK-0007 | сильная |
| [TASK-0009 Добавить совместимый Canvas 2D renderer](TASK-0009-canvas-fallback.md) | draft | normal | TASK-0002, TASK-0005, TASK-0008 | средняя |
| [TASK-0010 Подключить точный ввод мышью, touch и клавиатурой](TASK-0010-pointer-keyboard-input.md) | draft | normal | TASK-0005, TASK-0008 | средняя |
| [TASK-0011 Воспроизвести сбор и повороты с анимацией](TASK-0011-move-animation.md) | draft | normal | TASK-0005, TASK-0008 | сильная |
| [TASK-0012 Собрать игровой HUD и экран победы](TASK-0012-reference-hud-victory.md) | draft | normal | TASK-0007, TASK-0010, TASK-0011 | средняя |
| [TASK-0013 Откалибровать и принять визуальный срез](TASK-0013-visual-slice-acceptance.md) | draft | high | TASK-0009, TASK-0011, TASK-0012 | сильная |
| [TASK-0014 Сохранять устойчивую попытку и прогресс локально](TASK-0014-local-save.md) | draft | normal | TASK-0005, TASK-0007 | сильная |
| [TASK-0015 Добавить настройки, локализацию и выбор уровня](TASK-0015-settings-level-select-i18n.md) | draft | normal | TASK-0012, TASK-0014 | средняя |
| [TASK-0016 Добавить обучение, подсказку и честное сообщение о тупике](TASK-0016-hints-tutorial-deadlock.md) | draft | normal | TASK-0006, TASK-0015 | средняя |
| [TASK-0017 Проверить адаптивный экран и доступное управление](TASK-0017-responsive-accessibility.md) | draft | normal | TASK-0009, TASK-0010, TASK-0011, TASK-0015 | средняя |
| [TASK-0018 Добавить тихие звуковые эффекты с безопасным lifecycle](TASK-0018-audio-feedback.md) | draft | normal | TASK-0011, TASK-0015 | средняя |
| [TASK-0019 Собрать и проверить вертикальный срез из двенадцати уровней](TASK-0019-vertical-slice.md) | draft | high | TASK-0013, TASK-0014, TASK-0015, TASK-0016, TASK-0017, TASK-0018 | сильная |
| [TASK-0020 Создать внутренний редактор и валидатор контента](TASK-0020-internal-level-editor.md) | draft | normal | TASK-0006, TASK-0019 | сильная |
| [TASK-0021 Завершить первый блок кампании уровней 1–20](TASK-0021-campaign-basics.md) | draft | normal | TASK-0020 | средняя |
| [TASK-0022 Создать блок Повороты уровней 21–40](TASK-0022-campaign-turns.md) | draft | normal | TASK-0021 | средняя |
| [TASK-0023 Создать блок Пересечения уровней 41–60](TASK-0023-campaign-crossings.md) | draft | normal | TASK-0022 | средняя |
| [TASK-0024 Создать блок Пустые пути уровней 61–80](TASK-0024-campaign-empty-paths.md) | draft | normal | TASK-0023 | средняя |
| [TASK-0025 Создать блок Порядок сборки уровней 81–100](TASK-0025-campaign-assembly-order.md) | draft | normal | TASK-0024 | средняя |
| [TASK-0026 Завершить кампанию блоком Комбинации уровней 101–120](TASK-0026-campaign-combinations.md) | draft | normal | TASK-0025 | средняя |
| [TASK-0027 Загружать блоки контента с ошибками и повтором](TASK-0027-content-loading-errors.md) | draft | normal | TASK-0026, TASK-0015 | сильная |
| [TASK-0028 Добавить перенос прогресса и безопасное обновление сохранений](TASK-0028-save-import-migrations-tabs.md) | draft | normal | TASK-0014, TASK-0015, TASK-0027 | сильная |
| [TASK-0029 Добавить офлайн кэш и безопасное обновление PWA](TASK-0029-pwa-offline-updates.md) | draft | normal | TASK-0027, TASK-0028 | сильная |
| [TASK-0030 Проверить восстановление renderer и очистку ресурсов](TASK-0030-lifecycle-context-recovery.md) | draft | normal | TASK-0009, TASK-0011, TASK-0018, TASK-0029 | сильная |
| [TASK-0031 Измерить и выполнить бюджеты загрузки и производительности](TASK-0031-performance-budgets.md) | draft | normal | TASK-0026, TASK-0027, TASK-0029, TASK-0030 | сильная |
| [TASK-0032 Пройти обязательную матрицу браузеров и устройств](TASK-0032-platform-compatibility.md) | draft | normal | TASK-0017, TASK-0018, TASK-0028, TASK-0029, TASK-0030, TASK-0031 | средняя |
| [TASK-0033 Проверить понятность обучения и трудности с игроками](TASK-0033-player-usability.md) | draft | normal | TASK-0019, TASK-0026, TASK-0032 | средняя |
| [TASK-0034 Собрать и принять полную релизную версию без публикации](TASK-0034-release-candidate.md) | draft | high | TASK-0013, TASK-0026, TASK-0028, TASK-0029, TASK-0030, TASK-0031, TASK-0032, TASK-0033 | сильная |

Зависимую задачу переводить в ready после завершения и проверки всех зависимостей и актуализации контекста. TASK-0013 требует принятия визуального среза владельцем, TASK-0032 — фактической обязательной матрицы. Совместно затрагиваемые main/scene/UI/package файлы нельзя менять одновременно без согласования.
