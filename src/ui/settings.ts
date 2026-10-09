import { createLevelSelect, type LevelChoice } from './level-select.js';
import { t, type Language, type UserSettings } from './i18n.js';

type SettingsView = Readonly<{
  settings: UserSettings; choices: readonly LevelChoice[]; unlockedLevel: number; completed: readonly string[];
  selectedLevelId: string; memoryOnly: boolean; recoveryNotice: string;
  canHint: boolean;
}>;
export function createSettingsDialog(root: HTMLElement, actions: {
  close(): void; update(settings: UserSettings): void; selectLevel(id: string): void; clearProgress(): void; retry(): void; hint(): void;
}) {
  const panel = document.createElement('section'); panel.className = 'settings-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'settings-title'); panel.tabIndex = -1;
  const card = document.createElement('div'); card.className = 'settings-card';
  const settingsPage = document.createElement('div'); settingsPage.className = 'settings-page';
  const title = document.createElement('h2'); title.id = 'settings-title';
  const status = document.createElement('p'); status.className = 'settings-status'; status.setAttribute('role', 'status');
  const controls = document.createElement('div'); controls.className = 'settings-controls';
  const languageLabel = document.createElement('label'); languageLabel.className = 'setting-row';
  const languageName = document.createElement('span'); languageLabel.append(languageName);
  const languageSelect = document.createElement('select'); languageSelect.setAttribute('aria-label', 'Language');
  languageSelect.innerHTML = '<option value="en">English</option><option value="ru">Русский</option>'; languageLabel.append(languageSelect);
  const motionLabel = document.createElement('label'); motionLabel.className = 'setting-row';
  const motionName = document.createElement('span'); motionLabel.append(motionName);
  const motionInput = document.createElement('input'); motionInput.type = 'checkbox'; motionLabel.append(motionInput);
  const contrastLabel = document.createElement('label'); contrastLabel.className = 'setting-row';
  const contrastName = document.createElement('span'); contrastLabel.append(contrastName);
  const contrastInput = document.createElement('input'); contrastInput.type = 'checkbox'; contrastInput.setAttribute('aria-label', 'High contrast'); contrastLabel.append(contrastInput);
  const soundLabel = document.createElement('label'); soundLabel.className = 'setting-row';
  const soundName = document.createElement('span'); soundLabel.append(soundName);
  const soundInput = document.createElement('input'); soundInput.type = 'checkbox'; soundLabel.append(soundInput);
  const volumeLabel = document.createElement('label'); volumeLabel.className = 'setting-row volume-row';
  const volumeName = document.createElement('span'); volumeLabel.append(volumeName);
  const volumeInput = document.createElement('input'); volumeInput.type = 'range'; volumeInput.min = '0'; volumeInput.max = '1'; volumeInput.step = '0.05'; volumeLabel.append(volumeInput);
  const volumeValue = document.createElement('output'); volumeValue.className = 'volume-value'; volumeLabel.append(volumeValue);
  const rendererLabel = document.createElement('label'); rendererLabel.className = 'setting-row';
  const rendererName = document.createElement('span'); rendererLabel.append(rendererName);
  const rendererSelect = document.createElement('select'); rendererSelect.setAttribute('aria-label', 'Graphics mode');
  rendererSelect.innerHTML = '<option value="auto"></option><option value="webgl"></option><option value="2d"></option>'; rendererLabel.append(rendererSelect);
  const levelButton = document.createElement('button'); levelButton.type = 'button'; levelButton.className = 'menu-secondary';
  const hintButton = document.createElement('button'); hintButton.type = 'button'; hintButton.className = 'menu-secondary';
  const audioNote = document.createElement('p'); audioNote.className = 'settings-note';
  const clearButton = document.createElement('button'); clearButton.type = 'button'; clearButton.className = 'menu-danger';
  const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'settings-close';
  const confirmPane = document.createElement('div'); confirmPane.className = 'clear-confirmation'; confirmPane.hidden = true;
  const confirmText = document.createElement('p'); const confirmButton = document.createElement('button'); confirmButton.type = 'button'; confirmButton.className = 'menu-danger';
  const cancelButton = document.createElement('button'); cancelButton.type = 'button'; cancelButton.className = 'menu-secondary';
  confirmPane.append(confirmText, confirmButton, cancelButton);
  controls.append(languageLabel, motionLabel, contrastLabel, soundLabel, volumeLabel, rendererLabel, levelButton, hintButton, audioNote, clearButton, closeButton);
  settingsPage.append(title, status, controls, confirmPane);
  const levelPage = document.createElement('div'); levelPage.className = 'level-select-page'; levelPage.hidden = true;
  card.append(settingsPage, levelPage); panel.append(card); root.append(panel);
  const levelSelect = createLevelSelect(levelPage, { select: actions.selectLevel, back() { panel.setAttribute('aria-labelledby', 'settings-title'); levelPage.hidden = true; settingsPage.hidden = false; closeButton.focus(); } });
  let view: SettingsView | undefined;
  function focusable(): HTMLElement[] { return [...panel.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), input:not([disabled]):not([hidden])')].filter(el => el.offsetParent !== null); }
  function onKeydown(event: KeyboardEvent): void {
    if (!panel.classList.contains('is-visible')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (!confirmPane.hidden) { confirmPane.hidden = true; clearButton.hidden = false; clearButton.focus(); }
      else actions.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable(); if (!items.length) { event.preventDefault(); panel.focus(); return; }
    const first = items[0]!; const last = items.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  function update(input: SettingsView): void {
    view = input; const { settings } = input; const language = settings.language;
    panel.lang = language; panel.dir = 'ltr'; title.textContent = t(language, 'settings'); languageName.textContent = t(language, 'language');
    motionName.textContent = t(language, 'reducedMotion'); contrastName.textContent = t(language, 'highContrast'); rendererName.textContent = t(language, 'renderer');
    rendererSelect.options[0]!.textContent = t(language, 'auto'); rendererSelect.options[1]!.textContent = t(language, 'webgl'); rendererSelect.options[2]!.textContent = t(language, 'canvas');
    languageSelect.value = settings.language; motionInput.checked = settings.reducedMotion; contrastInput.checked = settings.highContrast;
    soundInput.checked = settings.soundEnabled; volumeInput.value = String(settings.soundVolume); volumeValue.value = `${Math.round(settings.soundVolume * 100)}%`; rendererSelect.value = settings.rendererMode;
    languageSelect.setAttribute('aria-label', t(language, 'language'));
    contrastInput.setAttribute('aria-label', t(language, 'highContrast'));
    soundName.textContent = t(language, 'sound'); soundInput.setAttribute('aria-label', t(language, 'sound'));
    volumeName.textContent = t(language, 'volume'); volumeInput.setAttribute('aria-label', t(language, 'volume'));
    rendererSelect.setAttribute('aria-label', t(language, 'renderer'));
    levelButton.textContent = `${t(language, 'levels')} · ${input.unlockedLevel}/${input.choices.length}`;
    hintButton.textContent = t(language, 'hint'); hintButton.disabled = !input.canHint;
    clearButton.textContent = t(language, 'clearProgress'); closeButton.textContent = t(language, 'back');
    audioNote.textContent = t(language, 'audioLater');
    status.textContent = input.memoryOnly ? t(language, 'memory') : input.recoveryNotice;
    status.classList.toggle('is-warning', input.memoryOnly || !!input.recoveryNotice);
    let retryButton: HTMLButtonElement | null = status.nextElementSibling instanceof HTMLButtonElement && status.nextElementSibling.classList.contains('storage-retry')
      ? status.nextElementSibling : null;
    if (!retryButton) { retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.className = 'storage-retry menu-secondary'; retryButton.addEventListener('click', actions.retry); status.after(retryButton); }
    retryButton.textContent = t(language, 'retry'); retryButton.hidden = !input.memoryOnly;
    clearButton.hidden = !confirmPane.hidden;
    levelSelect.update({ language, choices: input.choices, unlockedLevel: input.unlockedLevel, completed: input.completed, selectedLevelId: input.selectedLevelId });
  }
  function changeSettings(patch: Partial<UserSettings>): void {
    if (!view) return;
    const settings = Object.freeze({ ...view.settings, ...patch });
    view = Object.freeze({ ...view, settings });
    actions.update(settings);
  }
  languageSelect.addEventListener('change', () => changeSettings({ language: languageSelect.value === 'ru' ? 'ru' : 'en' }));
  motionInput.addEventListener('change', () => changeSettings({ reducedMotion: motionInput.checked }));
  contrastInput.addEventListener('change', () => changeSettings({ highContrast: contrastInput.checked }));
  soundInput.addEventListener('change', () => changeSettings({ soundEnabled: soundInput.checked }));
  volumeInput.addEventListener('input', () => { volumeValue.value = `${Math.round(Number(volumeInput.value) * 100)}%`; });
  volumeInput.addEventListener('change', () => changeSettings({ soundVolume: Number(volumeInput.value) }));
  rendererSelect.addEventListener('change', () => changeSettings({ rendererMode: rendererSelect.value as UserSettings['rendererMode'] }));
  levelButton.addEventListener('click', () => { settingsPage.hidden = true; levelPage.hidden = false; levelSelect.render(); focusable()[0]?.focus(); });
  hintButton.addEventListener('click', actions.hint);
  clearButton.addEventListener('click', () => { confirmText.textContent = t(view?.settings.language ?? 'en', 'clearQuestion'); confirmButton.textContent = t(view?.settings.language ?? 'en', 'confirmClear'); cancelButton.textContent = t(view?.settings.language ?? 'en', 'cancel'); confirmPane.hidden = false; clearButton.hidden = true; confirmButton.focus(); });
  cancelButton.addEventListener('click', () => { confirmPane.hidden = true; clearButton.hidden = false; clearButton.focus(); });
  confirmButton.addEventListener('click', () => { confirmPane.hidden = true; clearButton.hidden = false; actions.clearProgress(); });
  closeButton.addEventListener('click', actions.close);
  panel.addEventListener('keydown', onKeydown);
  function open(): void { panel.classList.add('is-visible'); panel.setAttribute('aria-hidden', 'false'); settingsPage.hidden = false; levelPage.hidden = true; confirmPane.hidden = true; closeButton.hidden = false; closeButton.focus(); }
  function close(): void { panel.classList.remove('is-visible'); panel.setAttribute('aria-hidden', 'true'); }
  function showLevels(): void { panel.setAttribute('aria-labelledby', 'level-select-title'); settingsPage.hidden = true; levelPage.hidden = false; levelSelect.render(); focusable()[0]?.focus(); }
  function dispose(): void { panel.removeEventListener('keydown', onKeydown); panel.remove(); }
  return Object.freeze({ update, open, close, showLevels, dispose, isVisible: () => panel.classList.contains('is-visible') });
}
