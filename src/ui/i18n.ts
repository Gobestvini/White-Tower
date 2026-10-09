export type Language = 'en' | 'ru';
export type RendererPreference = 'auto' | 'webgl' | '2d';
export type UserSettings = Readonly<{ language: Language; reducedMotion: boolean; rendererMode: RendererPreference; tutorialCompleted: boolean }>;

const messages = {
  en: {
    settings: 'Settings', back: 'BACK TO GAME', levels: 'Choose level', backSettings: 'BACK TO SETTINGS', hint: 'Hint',
    reducedMotion: 'Reduce motion', language: 'Language', renderer: 'Graphics mode', auto: 'Automatic', webgl: 'WebGL', canvas: 'Canvas 2D',
    progress: 'Campaign progress', clearProgress: 'Clear progress', clearQuestion: 'Clear all completed levels and saved attempts?', confirmClear: 'CLEAR PROGRESS', cancel: 'CANCEL',
    locked: 'Locked', completed: 'Completed', current: 'Current level', memory: 'Progress is temporary because browser storage is unavailable.', retry: 'Retry storage',
    audioLater: 'Sound settings will be available later.', level: 'Level', undo: 'UNDO', next: 'NEXT', win: 'COMPLETED!', campaignComplete: 'Campaign complete. Choose any unlocked level.', chooseLevel: 'CHOOSE LEVEL',
    tapHighlighted: 'Tap the highlighted arrow', searching: 'Searching for a safe move…', hintTimeout: 'Search timed out. You can try Undo; no dead end was proven.', noSolution: 'No solution exists from this state.', searchingPrevious: 'Checking whether the previous move can be undone…',
    'action.undo': 'UNDO', 'action.next': 'NEXT', 'win.title': 'LEVEL COMPLETED!', 'tutorial.tap': 'Tap the arrow', 'hint.undo': 'Undo the last move', 'game.stuck': 'Try undoing a move', 'action.retry': 'Retry', 'hint.loading': 'Searching for a safe move…',
  },
  ru: {
    settings: 'Настройки', back: 'ВЕРНУТЬСЯ В ИГРУ', levels: 'Выбор уровня', backSettings: 'К НАСТРОЙКАМ', hint: 'Подсказка',
    reducedMotion: 'Уменьшить движение', language: 'Язык', renderer: 'Режим графики', auto: 'Автоматически', webgl: 'WebGL', canvas: 'Canvas 2D',
    progress: 'Прогресс кампании', clearProgress: 'Сбросить прогресс', clearQuestion: 'Удалить пройденные уровни и сохранённые попытки?', confirmClear: 'СБРОСИТЬ ПРОГРЕСС', cancel: 'ОТМЕНА',
    locked: 'Закрыт', completed: 'Пройден', current: 'Текущий уровень', memory: 'Прогресс временный: хранилище браузера недоступно.', retry: 'Повторить загрузку',
    audioLater: 'Настройки звука появятся позже.', level: 'Уровень', undo: 'НАЗАД', next: 'ДАЛЕЕ', win: 'ПРОЙДЕН!', campaignComplete: 'Кампания пройдена. Выберите открытый уровень.', chooseLevel: 'ВЫБРАТЬ УРОВЕНЬ',
    tapHighlighted: 'Нажмите на выделенную стрелку', searching: 'Ищу безопасный ход…', hintTimeout: 'Поиск не завершился. Можно отменить ход; тупик не доказан.', noSolution: 'Из этого состояния решения нет.', searchingPrevious: 'Проверяю, можно ли отменить предыдущий ход…',
    'action.undo': 'НАЗАД', 'action.next': 'ДАЛЕЕ', 'win.title': 'УРОВЕНЬ ПРОЙДЕН!', 'tutorial.tap': 'Нажмите на стрелку', 'hint.undo': 'Отмените последний ход', 'game.stuck': 'Попробуйте отменить ход', 'action.retry': 'Повторить', 'hint.loading': 'Ищу безопасный ход…',
  },
} as const;
export type MessageKey = keyof typeof messages.en;
export function t(language: Language, key: MessageKey): string { return messages[language][key]; }
export function parseSettings(value: unknown): UserSettings {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return Object.freeze({
    language: record.language === 'ru' ? 'ru' : 'en',
    reducedMotion: record.reducedMotion === true,
    rendererMode: record.rendererMode === 'webgl' || record.rendererMode === '2d' ? record.rendererMode : 'auto',
    tutorialCompleted: record.tutorialCompleted === true,
  });
}
