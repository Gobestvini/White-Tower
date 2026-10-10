import { artImage } from './art.js';
import { t, type Language } from './i18n.js';

export function createServiceScreen(root: HTMLElement) {
  const loading = document.createElement('section'); loading.className = 'loading-screen'; loading.setAttribute('role', 'status');
  const label = document.createElement('p');
  const progress = document.createElement('progress'); progress.setAttribute('aria-label', 'Loading');
  loading.append(artImage('logo', 'game-logo'), artImage('loading', 'loading-tower'), progress, label);
  root.append(loading);
  const error = root.querySelector<HTMLElement>('#load-error')!;
  error.prepend(artImage('graphics', 'service-illustration'));
  let failed = false;
  function update(loaded: boolean, supported: boolean, language: Language): void {
    loading.lang = language; error.lang = language;
    error.dataset.kind = supported ? 'content' : 'graphics';
    label.textContent = t(language, 'service.loading');
    progress.setAttribute('aria-label', label.textContent);
    loading.hidden = loaded || failed || !supported;
    if (!supported || failed) {
      error.hidden = false;
      error.querySelector('p')!.textContent = t(language, !supported ? 'service.graphicsError' : 'service.contentError');
      error.querySelector('button')!.textContent = t(language, 'action.retry');
    } else error.hidden = true;
  }
  return { update, fail() { failed = true; loading.hidden = true; error.hidden = false; }, dispose() { loading.remove(); } };
}
