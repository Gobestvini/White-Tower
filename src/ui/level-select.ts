import { t, type Language } from './i18n.js';

export type LevelChoice = Readonly<{ id: string; index: number }>;
export function createLevelSelect(root: HTMLElement, actions: { select(id: string): void; back(): void }) {
  const heading = document.createElement('h3');
  heading.id = 'level-select-title';
  const grid = document.createElement('div'); grid.className = 'level-grid';
  const progress = document.createElement('p'); progress.className = 'level-progress';
  const pagination = document.createElement('nav'); pagination.className = 'level-pagination';
  const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '‹';
  const next = document.createElement('button'); next.type = 'button'; next.textContent = '›';
  const pageLabel = document.createElement('span'); pageLabel.setAttribute('role', 'status');
  pagination.append(previous, pageLabel, next);
  const back = document.createElement('button'); back.type = 'button'; back.className = 'menu-secondary'; back.addEventListener('click', actions.back);
  root.append(heading, progress, grid, pagination, back);
  let language: Language = 'en';
  let choices: readonly LevelChoice[] = [];
  let unlocked = 1;
  let completed: readonly string[] = [];
  let selected = '';
  let renderKey = '';
  let page = 0;
  previous.addEventListener('click', () => { page = Math.max(0, page - 1); render(); (previous.disabled ? next : previous).focus(); });
  next.addEventListener('click', () => { page = Math.min(Math.max(0, Math.ceil(choices.length / 30) - 1), page + 1); render(); (next.disabled ? previous : next).focus(); });
  function render(): void {
    heading.textContent = t(language, 'levels'); back.textContent = t(language, 'backSettings'); grid.replaceChildren();
    progress.textContent = language === 'ru' ? `${completed.length} из ${choices.length} пройдено` : `${completed.length} of ${choices.length} completed`;
    previous.setAttribute('aria-label', language === 'ru' ? 'Предыдущая страница уровней' : 'Previous levels page');
    next.setAttribute('aria-label', language === 'ru' ? 'Следующая страница уровней' : 'Next levels page');
    previous.disabled = page === 0; next.disabled = (page + 1) * 30 >= choices.length;
    pageLabel.textContent = `${page * 30 + 1}–${Math.min((page + 1) * 30, choices.length)} / ${choices.length}`;
    for (const choice of choices.slice(page * 30, (page + 1) * 30)) {
      const available = choice.index <= unlocked;
      const done = completed.includes(choice.id);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'level-card';
      button.disabled = !available; button.setAttribute('aria-label', `${t(language, 'level')} ${choice.index}${!available ? `, ${t(language, 'locked')}` : done ? `, ${t(language, 'completed')}` : ''}`);
      if (done) button.classList.add('is-completed');
      if (choice.id === selected) button.classList.add('is-selected');
      button.textContent = `${choice.index}${done ? ' ✓' : !available ? ' 🔒' : ''}`;
      button.addEventListener('click', () => { if (available) actions.select(choice.id); }); grid.append(button);
    }
  }
  return Object.freeze({ update(input: { language: Language; choices: readonly LevelChoice[]; unlockedLevel: number; completed: readonly string[]; selectedLevelId: string }) {
    const nextKey = JSON.stringify(input);
    if (nextKey === renderKey) return;
    if (input.selectedLevelId !== selected) {
      const selectedIndex = input.choices.findIndex(choice => choice.id === input.selectedLevelId);
      page = Math.floor(Math.max(0, selectedIndex) / 30);
    }
    renderKey = nextKey; language = input.language; choices = input.choices; unlocked = input.unlockedLevel; completed = input.completed; selected = input.selectedLevelId; render();
  }, render });
}
