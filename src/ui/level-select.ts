import { t, type Language } from './i18n.js';

export type LevelChoice = Readonly<{ id: string; index: number }>;
export function createLevelSelect(root: HTMLElement, actions: { select(id: string): void; back(): void }) {
  const heading = document.createElement('h3');
  heading.id = 'level-select-title';
  const grid = document.createElement('div'); grid.className = 'level-grid';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'menu-secondary'; back.addEventListener('click', actions.back);
  root.append(heading, grid, back);
  let language: Language = 'en';
  let choices: readonly LevelChoice[] = [];
  let unlocked = 1;
  let completed: readonly string[] = [];
  let selected = '';
  let renderKey = '';
  function render(): void {
    heading.textContent = t(language, 'levels'); back.textContent = t(language, 'backSettings'); grid.replaceChildren();
    for (const choice of choices) {
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
    renderKey = nextKey; language = input.language; choices = input.choices; unlocked = input.unlockedLevel; completed = input.completed; selected = input.selectedLevelId; render();
  }, render });
}
