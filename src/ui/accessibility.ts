import type { GameState, Level, Stack } from '../game/model.js';
import type { Language } from './i18n.js';
import { t } from './i18n.js';

export type AccessibleStack = Readonly<{ stack: Stack; direction: string }>;
export type BoardDescription = Readonly<{
  level: Level;
  state: GameState;
  levelNumber: number;
  language: Language;
  selectedStackId?: string;
  activeStacks: readonly AccessibleStack[];
}>;

export function describeBoard(input: BoardDescription): string {
  const { level, state, levelNumber, language, selectedStackId, activeStacks } = input;
  const highest = Math.max(0, ...state.stacks.map(stack => Math.floor(stack.height)));
  const count = highest < 2 ? 0 : highest;
  const header = language === 'ru'
    ? `Уровень ${levelNumber}. Собрано ${count} из ${level.totalTiles} плиток.`
    : `Level ${levelNumber}. ${count} of ${level.totalTiles} tiles gathered.`;
  const arrows = activeStacks.length === 0
    ? (language === 'ru' ? 'Активных стрелок нет.' : 'No active arrows.')
    : activeStacks.map(({ stack, direction }, index) => {
      const selected = stack.id === selectedStackId;
      if (language === 'ru') return `${selected ? 'Выбрана' : 'Стрелка'} ${index + 1}: координаты ${stack.u}, ${stack.v}, высота ${stack.height}, направление ${direction}.`;
      return `${selected ? 'Selected arrow' : 'Arrow'} ${index + 1}: coordinates ${stack.u}, ${stack.v}, height ${stack.height}, direction ${direction}.`;
    }).join(' ');
  return `${header} ${arrows}`;
}

export function keyboardAnnouncement(language: Language, action: 'selection' | 'move' | 'undo' | 'restart' | 'menu', index?: number, count?: number): string {
  const key = action === 'selection' ? 'a11y.selection' : action === 'move' ? 'a11y.move' : action === 'undo' ? 'a11y.undo' : action === 'restart' ? 'a11y.restart' : 'a11y.menu';
  return t(language, key).replace('{index}', String(index ?? '')).replace('{count}', String(count ?? ''));
}

export function createBoardDescription(root: HTMLElement) {
  const element = document.createElement('p');
  element.id = 'board-description';
  element.className = 'visually-hidden';
  root.append(element);
  const canvas = root.querySelector('canvas');
  canvas?.setAttribute('aria-describedby', element.id);
  let previous = '';
  return Object.freeze({
    update(input: BoardDescription): void {
      const next = describeBoard(input);
      if (next !== previous) { previous = next; element.textContent = next; }
    },
    dispose(): void { canvas?.removeAttribute('aria-describedby'); element.remove(); },
  });
}
