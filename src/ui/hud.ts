import type { GameSnapshot } from '../game/controller.js';
import type { AnimationSnapshot } from '../presentation/animation.js';
import { createVictoryOverlay } from './victory.js';
import { createSettingsDialog } from './settings.js';
import { t, type UserSettings } from './i18n.js';
import { createHintToast } from './hint.js';
import { createTutorialTip } from './tutorial.js';
import type { HintView } from '../game/hint-service.js';
import { createBoardDescription } from './accessibility.js';
import type { Stack } from '../game/model.js';
import { artImage } from './art.js';

type HudOptions = {
  root: HTMLElement;
  onReset(): void;
  onUndo(): void;
  onNext(): Promise<{ advanced: boolean; message?: string }>;
  onMenu(): void;
  getSettings(): UserSettings;
  onSettings(settings: UserSettings): void;
  onSelectLevel(id: string): void;
  onClearProgress(): void;
  onRetry(): void;
  onChooseLevels(): void;
  onHint(): void;
  onExportProgress(): Promise<string>;
  onImportProgress(raw: unknown): Promise<boolean>;
};
type HudSnapshot = GameSnapshot & Readonly<{ levelNumber?: number; levelCount?: number; unlockedLevel?: number; settings?: UserSettings; persistence?: { memoryOnly: boolean; recoveryNotice: string }; tutorialVisible?: boolean; hintView?: HintView; selectedStackId?: string; activeStacks?: readonly { stack: Stack; direction: string }[] }>;

const icons = {
  settings: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 4h8l1.3 5.1a16 16 0 0 1 3.2 1.3l4.7-2.3 5.7 5.7-2.3 4.7a16 16 0 0 1 1.3 3.2L47 27v8l-5.1 1.3a16 16 0 0 1-1.3 3.2l2.3 4.7-5.7 5.7-4.7-2.3a16 16 0 0 1-3.2 1.3L28 54h-8l-1.3-5.1a16 16 0 0 1-3.2-1.3l-4.7 2.3-5.7-5.7 2.3-4.7a16 16 0 0 1-1.3-3.2L1 35v-8l5.1-1.3a16 16 0 0 1 1.3-3.2l-2.3-4.7 5.7-5.7 4.7 2.3a16 16 0 0 1 3.2-1.3z" transform="translate(1 -5) scale(.85)"/><circle cx="24" cy="24" r="7" class="icon-cutout"/></svg>',
  restart: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 18A16 16 0 0 0 11 12l-4 4m0 0V6m0 10h10M9 30a16 16 0 0 0 28 6l4-4m0 0v10m0-10H31"/></svg>',
  undo: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 13 8 23l11 10M9 23h19a12 12 0 0 1 0 24h-5"/></svg>',
};

function makeButton(label: string, icon: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  return button;
}

export function createHud(options: HudOptions) {
  const { root } = options;
  const logo = artImage('logo', 'game-logo');
  const hint = makeButton('Hint', '<span>?</span>', 'hud-hint');
  hint.addEventListener('click', options.onHint);
  const settings = makeButton('Settings', icons.settings, 'hud-icon settings-button');
  const restart = makeButton('Restart level', icons.restart, 'hud-icon restart-button');
  const counter = document.createElement('div');
  counter.className = 'hud-counter';
  counter.setAttribute('role', 'status');
  counter.setAttribute('aria-live', 'polite');
  const level = document.createElement('div');
  level.className = 'hud-level';
  const undo = makeButton('Undo last move', icons.undo + '<span>UNDO</span>', 'hud-undo');
  root.append(logo, settings, restart, counter, level, undo, hint);
  const menu = createSettingsDialog(root, {
    close: options.onMenu,
    update: options.onSettings,
    selectLevel: options.onSelectLevel,
    clearProgress: options.onClearProgress,
    retry: options.onRetry,
    hint: options.onHint,
    exportProgress: options.onExportProgress,
    importProgress: options.onImportProgress,
  });
  let pendingLevelChooser = false;
  const victory = createVictoryOverlay(root, {
    undo: options.onUndo,
    next: () => { void runNext(); },
    chooseLevels: () => { pendingLevelChooser = true; options.onChooseLevels(); },
  });
  const hintToast = createHintToast(root);
  const tutorialTip = createTutorialTip(root);
  const boardDescription = createBoardDescription(root.parentElement ?? root);
  let currentPhase = '';
  let menuWasOpen = false;
  let nextPending = false;
  let campaignMessage = '';
  let countText = '';
  let counterLanguage = '';
  let levelText = '';

  async function runNext(): Promise<void> {
    if (nextPending) return;
    nextPending = true;
    campaignMessage = '';
    try {
      const result = await options.onNext();
      if (!result.advanced) campaignMessage = result.message ?? t(options.getSettings().language, 'service.moreLevels');
    } catch {
      campaignMessage = t(options.getSettings().language, 'service.nextError');
    } finally { nextPending = false; }
  }
  const openMenu = () => { settings.focus(); options.onMenu(); };
  settings.addEventListener('click', openMenu);
  restart.addEventListener('click', options.onReset);
  undo.addEventListener('click', options.onUndo);

  function update(snapshot: HudSnapshot, presentation: AnimationSnapshot, dt: number): void {
    const stable = snapshot.phase === 'Idle' || snapshot.phase === 'Won';
    const inMenu = snapshot.phase === 'Menu';
    const currentStacks = snapshot.phase === 'Animating' && presentation.active
      ? presentation.stacks
      : snapshot.displayedState?.stacks ?? snapshot.committedState?.stacks ?? [];
    const highest = Math.max(0, ...currentStacks.map(stack => Math.floor(stack.height)));
    const currentCount = highest < 2 ? 0 : highest;
    const nextCount = `${currentCount}/${snapshot.level?.totalTiles ?? 0}`;
    const language = snapshot.settings?.language ?? options.getSettings().language;
    root.lang = language;
    root.parentElement!.dataset.screen = wonScreen(snapshot);
    hint.textContent = t(language, 'hint'); hint.setAttribute('aria-label', t(language, 'hint'));
    hint.disabled = snapshot.phase !== 'Idle';
    hint.hidden = snapshot.phase === 'Won' || inMenu;
    settings.setAttribute('aria-label', language === 'ru' ? 'Настройки' : 'Settings');
    restart.setAttribute('aria-label', language === 'ru' ? 'Перезапустить уровень' : 'Restart level');
    undo.setAttribute('aria-label', language === 'ru' ? 'Отменить ход' : 'Undo last move');
    const nextLevel = snapshot.level ? `${language === 'ru' ? 'Уровень' : 'Level'} ${snapshot.levelNumber ?? 1}` : (language === 'ru' ? 'Уровень' : 'Level');
    root.dataset.tutorialOriginal = String(language === 'ru' && (snapshot.levelNumber ?? 1) === 1 && nextCount === '0/4');
    if (countText !== nextCount || counterLanguage !== language) { counterLanguage = language; countText = nextCount; counter.textContent = nextCount; counter.setAttribute('aria-label', language === 'ru' ? `Собрано ${currentCount} из ${snapshot.level?.totalTiles ?? 0} плиток` : `${currentCount} of ${snapshot.level?.totalTiles ?? 0} tiles gathered`); }
    if (levelText !== nextLevel) { levelText = nextLevel; level.textContent = nextLevel; }
    const won = snapshot.phase === 'Won';
    root.parentElement?.classList.toggle('is-won', won);
    for (const element of [counter, level, undo]) element.classList.toggle('is-hidden', won);
    restart.disabled = !stable;
    undo.disabled = !stable || !snapshot.canUndo;
    settings.disabled = !['Idle', 'Won', 'Menu'].includes(snapshot.phase);
    if (snapshot.settings) victory.setLanguage(snapshot.settings.language);
    const currentSettings = snapshot.settings ?? options.getSettings();
    root.parentElement?.classList.toggle('high-contrast', !!currentSettings.highContrast);
    if (snapshot.level && snapshot.committedState) boardDescription.update({
      level: snapshot.level, state: snapshot.committedState, levelNumber: snapshot.levelNumber ?? 1,
      language, ...(snapshot.selectedStackId ? { selectedStackId: snapshot.selectedStackId } : {}),
      activeStacks: snapshot.activeStacks ?? [],
    });
    hintToast.update(snapshot.hintView ?? { kind: 'idle' }, language);
    tutorialTip.update(!!snapshot.tutorialVisible, language);
    const persistence = snapshot.persistence ?? { memoryOnly: false, recoveryNotice: '' };
    menu.update({
      settings: currentSettings,
      choices: Array.from({ length: snapshot.levelCount ?? 0 }, (_, index) => ({ id: `level-${String(index + 1).padStart(3, '0')}`, index: index + 1 })),
      unlockedLevel: snapshot.unlockedLevel ?? 1,
      completed: snapshot.completedLevelIds,
      selectedLevelId: snapshot.level?.id ?? '',
      memoryOnly: persistence.memoryOnly,
      recoveryNotice: persistence.recoveryNotice,
      canHint: snapshot.phase === 'Menu' && snapshot.menuReturn === 'Idle',
    });
    if (inMenu && !menuWasOpen) { menu.open(); if (pendingLevelChooser) { menu.showLevels(); pendingLevelChooser = false; } }
    else if (!inMenu && menuWasOpen) { menu.close(); settings.focus(); }
    menuWasOpen = inMenu;
    const campaignComplete = won && !!snapshot.levelCount && snapshot.levelNumber === snapshot.levelCount;
    victory.update(snapshot, dt, nextPending, campaignMessage, campaignComplete);
  }

  function dispose(): void {
    settings.removeEventListener('click', openMenu);
    restart.removeEventListener('click', options.onReset);
    undo.removeEventListener('click', options.onUndo);
    victory.dispose(); menu.dispose(); hintToast.dispose(); tutorialTip.dispose(); boardDescription.dispose();
    hint.removeEventListener('click', options.onHint);
    settings.remove(); restart.remove(); counter.remove(); level.remove(); undo.remove(); hint.remove(); logo.remove();
  }
  return Object.freeze({ update, dispose });
}

function wonScreen(snapshot: HudSnapshot): string {
  if (snapshot.phase === 'Won') return snapshot.levelNumber === snapshot.levelCount ? 'campaign' : 'victory';
  if (snapshot.tutorialVisible) return 'tutorial';
  if (snapshot.hintView?.kind === 'move') return 'hint';
  return 'gameplay';
}
