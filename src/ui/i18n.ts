export type Language = 'en' | 'ru';
export type RendererPreference = 'auto' | 'webgl' | '2d';
export type UserSettings = Readonly<{ language: Language; reducedMotion: boolean; highContrast: boolean; soundEnabled: boolean; soundVolume: number; rendererMode: RendererPreference; tutorialCompleted: boolean }>;

const messages = {
  en: {
    'service.loading': 'Loading level…', 'service.contentError': 'Could not load White Tower content. Check the connection and retry.',
    'service.graphicsError': 'Graphics could not start. Try another browser or reload.', 'service.nextError': 'Could not load the next level. Try again.',
    'service.notReady': 'Next level is not ready.', 'service.moreLevels': 'More levels are coming soon.',
    settings: 'Settings', back: 'BACK TO GAME', levels: 'Choose level', backSettings: 'BACK TO SETTINGS', hint: 'Hint',
    reducedMotion: 'Reduce motion', language: 'Language', renderer: 'Graphics mode', auto: 'Automatic', webgl: 'WebGL', canvas: 'Canvas 2D',
    highContrast: 'High contrast',
    sound: 'Sound effects', volume: 'Volume',
    progress: 'Campaign progress', clearProgress: 'Clear progress', clearQuestion: 'Clear all completed levels and saved attempts?', confirmClear: 'CLEAR PROGRESS', cancel: 'CANCEL',
    locked: 'Locked', completed: 'Completed', current: 'Current level', memory: 'Progress is temporary because browser storage is unavailable.', retry: 'Retry storage',
    audioLater: 'Short synthesized effects play after your first input.', level: 'Level', undo: 'UNDO', next: 'NEXT', win: 'COMPLETED!', campaignComplete: 'Campaign complete. Choose any unlocked level.', chooseLevel: 'CHOOSE LEVEL',
    tapHighlighted: 'Tap the highlighted arrow', searching: 'Searching for a safe move…', hintTimeout: 'Search timed out. You can try Undo; no dead end was proven.', noSolution: 'No solution exists from this state.', searchingPrevious: 'Checking whether the previous move can be undone…',
    'action.undo': 'UNDO', 'action.next': 'NEXT', 'win.title': 'LEVEL COMPLETED!', 'tutorial.tap': 'Tap the arrow', 'hint.undo': 'Undo the last move', 'game.stuck': 'Try undoing a move', 'action.retry': 'Retry', 'hint.loading': 'Searching for a safe move…',
    'a11y.selection': 'Selected stack {index} of {count}.', 'a11y.move': 'Move started.', 'a11y.undo': 'Move undone.', 'a11y.restart': 'Level restarted.', 'a11y.menu': 'Settings opened. Press Escape to return to the game.',
  },
  ru: {
    'service.loading': 'Загрузка уровня…', 'service.contentError': 'Не удалось загрузить игру. Проверьте соединение и повторите попытку.',
    'service.graphicsError': 'Не удалось запустить графику. Попробуйте другой браузер или повторите загрузку.', 'service.nextError': 'Не удалось загрузить следующий уровень. Повторите попытку.',
    'service.notReady': 'Следующий уровень ещё не готов.', 'service.moreLevels': 'Новые уровни скоро появятся.',
    settings: 'Настройки', back: 'ВЕРНУТЬСЯ В ИГРУ', levels: 'Выбор уровня', backSettings: 'К НАСТРОЙКАМ', hint: 'Подсказка',
    reducedMotion: 'Уменьшить движение', language: 'Язык', renderer: 'Режим графики', auto: 'Автоматически', webgl: 'WebGL', canvas: 'Canvas 2D',
    highContrast: 'Высокая контрастность',
    sound: 'Звуковые эффекты', volume: 'Громкость',
    progress: 'Прогресс кампании', clearProgress: 'Сбросить прогресс', clearQuestion: 'Удалить пройденные уровни и сохранённые попытки?', confirmClear: 'СБРОСИТЬ ПРОГРЕСС', cancel: 'ОТМЕНА',
    locked: 'Закрыт', completed: 'Пройден', current: 'Текущий уровень', memory: 'Прогресс временный: хранилище браузера недоступно.', retry: 'Повторить загрузку',
    audioLater: 'Короткие синтезированные звуки включаются после первого действия.', level: 'Уровень', undo: 'НАЗАД', next: 'ДАЛЕЕ', win: 'ПРОЙДЕН!', campaignComplete: 'Кампания пройдена. Выберите открытый уровень.', chooseLevel: 'ВЫБРАТЬ УРОВЕНЬ',
    tapHighlighted: 'Нажмите на выделенную стрелку', searching: 'Ищу безопасный ход…', hintTimeout: 'Поиск не завершился. Можно отменить ход; тупик не доказан.', noSolution: 'Из этого состояния решения нет.', searchingPrevious: 'Проверяю, можно ли отменить предыдущий ход…',
    'action.undo': 'НАЗАД', 'action.next': 'ДАЛЕЕ', 'win.title': 'УРОВЕНЬ ПРОЙДЕН!', 'tutorial.tap': 'Нажмите на стрелку', 'hint.undo': 'Отмените последний ход', 'game.stuck': 'Попробуйте отменить ход', 'action.retry': 'Повторить', 'hint.loading': 'Ищу безопасный ход…',
    'a11y.selection': 'Выбрана стопка {index} из {count}.', 'a11y.move': 'Ход запущен.', 'a11y.undo': 'Ход отменён.', 'a11y.restart': 'Уровень перезапущен.', 'a11y.menu': 'Настройки открыты. Нажмите Escape, чтобы вернуться в игру.',
  },
} as const;
export type MessageKey = keyof typeof messages.en;
export function t(language: Language, key: MessageKey): string { return messages[language][key]; }
export function parseSettings(value: unknown): UserSettings {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return Object.freeze({
    language: record.language === 'ru' ? 'ru' : 'en',
    reducedMotion: record.reducedMotion === true,
    highContrast: record.highContrast === true,
    soundEnabled: record.soundEnabled !== false,
    soundVolume: typeof record.soundVolume === 'number' && Number.isFinite(record.soundVolume) ? Math.max(0, Math.min(1, record.soundVolume)) : 0.4,
    rendererMode: record.rendererMode === 'webgl' || record.rendererMode === '2d' ? record.rendererMode : 'auto',
    tutorialCompleted: record.tutorialCompleted === true,
  });
}
