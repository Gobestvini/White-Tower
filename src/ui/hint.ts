import type { HintView } from '../game/hint-service.js';
import { t, type Language } from './i18n.js';

export function createHintToast(root: HTMLElement) {
  const element = document.createElement('p');
  element.className = 'hint-toast'; element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); element.hidden = true;
  root.append(element);
  function update(view: HintView, language: Language): void {
    const keys = {
      idle: '', searching: 'searching', move: 'tapHighlighted', 'undo-proven': 'hint.undo',
      'undo-suggestion': 'hintTimeout', deadlock: 'game.stuck', timeout: 'hintTimeout', error: 'hintTimeout',
    } as const;
    const key = keys[view.kind];
    element.textContent = key ? t(language, key) : '';
    element.hidden = !key;
    element.dataset.kind = view.kind;
    element.lang = language;
  }
  return Object.freeze({ update, dispose() { element.remove(); } });
}
