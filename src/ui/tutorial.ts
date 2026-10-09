import { t, type Language } from './i18n.js';

export function createTutorialTip(root: HTMLElement) {
  const element = document.createElement('p');
  element.className = 'tutorial-tip'; element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); element.hidden = true;
  root.append(element);
  function update(visible: boolean, language: Language): void {
    element.textContent = visible ? t(language, 'tutorial.tap') : '';
    element.hidden = !visible; element.lang = language;
  }
  return Object.freeze({ update, dispose() { element.remove(); } });
}
