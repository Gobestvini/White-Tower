import type { GameSnapshot } from '../game/controller.js';
import type { AnimationSnapshot } from '../presentation/animation.js';
import { createVictoryOverlay } from './victory.js';

type HudOptions = {
  root: HTMLElement;
  onReset(): void;
  onUndo(): void;
  onNext(): Promise<{ advanced: boolean; message?: string }>;
  onMenu(): void;
};
type HudSnapshot = GameSnapshot & Readonly<{ levelNumber?: number }>;

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
  const settings = makeButton('Settings', icons.settings, 'hud-icon settings-button');
  const restart = makeButton('Restart level', icons.restart, 'hud-icon restart-button');
  const counter = document.createElement('div');
  counter.className = 'hud-counter';
  counter.setAttribute('role', 'status');
  counter.setAttribute('aria-live', 'polite');
  const level = document.createElement('div');
  level.className = 'hud-level';
  const undo = makeButton('Undo last move', icons.undo + '<span>UNDO</span>', 'hud-undo');
  const panel = document.createElement('section');
  panel.className = 'settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'settings-title');
  panel.innerHTML = '<div class="settings-card"><h2 id="settings-title">Settings</h2><p>Game options will be available here.</p><button type="button" class="settings-close">BACK TO GAME</button></div>';
  const closeSettings = panel.querySelector<HTMLButtonElement>('.settings-close')!;
  root.append(settings, restart, counter, level, undo, panel);
  const victory = createVictoryOverlay(root, { undo: options.onUndo, next: () => { void runNext(); } });
  let currentPhase = '';
  let menuWasOpen = false;
  let nextPending = false;
  let campaignMessage = '';
  let countText = '';
  let levelText = '';

  async function runNext(): Promise<void> {
    if (nextPending) return;
    nextPending = true;
    campaignMessage = '';
    try {
      const result = await options.onNext();
      if (!result.advanced) campaignMessage = result.message ?? 'More levels are coming soon.';
    } catch {
      campaignMessage = 'Could not load the next level. Try again.';
    } finally { nextPending = false; }
  }
  settings.addEventListener('click', options.onMenu);
  restart.addEventListener('click', options.onReset);
  undo.addEventListener('click', options.onUndo);
  closeSettings.addEventListener('click', options.onMenu);
  const refocusSettings = () => settings.focus();
  closeSettings.addEventListener('click', refocusSettings);

  function update(snapshot: HudSnapshot, presentation: AnimationSnapshot, dt: number): void {
    const stable = snapshot.phase === 'Idle' || snapshot.phase === 'Won';
    const inMenu = snapshot.phase === 'Menu';
    const currentStacks = snapshot.phase === 'Animating' && presentation.active
      ? presentation.stacks
      : snapshot.displayedState?.stacks ?? snapshot.committedState?.stacks ?? [];
    const highest = Math.max(0, ...currentStacks.map(stack => Math.floor(stack.height)));
    const currentCount = highest < 2 ? 0 : highest;
    const nextCount = `${currentCount}/${snapshot.level?.totalTiles ?? 0}`;
    const nextLevel = snapshot.level ? `Lv.${snapshot.levelNumber ?? 1}` : 'Lv.';
    if (countText !== nextCount) { countText = nextCount; counter.textContent = nextCount; counter.setAttribute('aria-label', `${currentCount} of ${snapshot.level?.totalTiles ?? 0} tiles gathered`); }
    if (levelText !== nextLevel) { levelText = nextLevel; level.textContent = nextLevel; }
    const won = snapshot.phase === 'Won';
    root.parentElement?.classList.toggle('is-won', won);
    for (const element of [counter, level, undo]) element.classList.toggle('is-hidden', won);
    restart.disabled = !stable;
    undo.disabled = !stable || !snapshot.canUndo;
    settings.disabled = !['Idle', 'Won', 'Menu'].includes(snapshot.phase);
    panel.classList.toggle('is-visible', inMenu);
    if (inMenu && !menuWasOpen) closeSettings.focus();
    menuWasOpen = inMenu;
    victory.update(snapshot, dt, nextPending, campaignMessage);
  }

  function dispose(): void {
    settings.removeEventListener('click', options.onMenu);
    restart.removeEventListener('click', options.onReset);
    undo.removeEventListener('click', options.onUndo);
    closeSettings.removeEventListener('click', options.onMenu);
    closeSettings.removeEventListener('click', refocusSettings);
    victory.dispose();
    settings.remove(); restart.remove(); counter.remove(); level.remove(); undo.remove(); panel.remove();
  }
  return Object.freeze({ update, dispose });
}
