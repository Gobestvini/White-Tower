type Intent = 'next' | 'previous' | 'launch' | 'undo' | 'restart' | 'menu' | undefined;

export function gameIntentForKey(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey'>, focused: boolean, editable = false): Intent {
  if (!focused || editable) return undefined;
  if (['ArrowRight', 'ArrowUp'].includes(event.key)) return 'next';
  if (['ArrowLeft', 'ArrowDown'].includes(event.key)) return 'previous';
  if (event.key === 'Enter' || event.code === 'Space') return 'launch';
  if (event.key.toLowerCase() === 'z' || (event.ctrlKey && event.key.toLowerCase() === 'z') || (event.metaKey && event.key.toLowerCase() === 'z')) return 'undo';
  if (event.key.toLowerCase() === 'r') return 'restart';
  if (event.key === 'Escape') return 'menu';
  return undefined;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
}

export function createGameActions(options: Readonly<{
  canvas(): HTMLCanvasElement;
  scene: {
    snapshot(): { phase: string; canUndo: boolean };
    selectableStacks(): readonly Readonly<{ id: string }> [];
    selectedStackId(): string | undefined;
    selectStack(id: string): boolean;
    launchStack(id: string): boolean;
    undo(): unknown;
    reset(): void;
    toggleMenu(): boolean;
  };
  announce(message: string): void;
  reset(): void;
  enabled?(): boolean;
  target?: Window;
}>) {
  const target = options.target ?? window;
  function down(event: KeyboardEvent): void {
    const canvas = options.canvas();
    if (options.enabled && !options.enabled()) return;
    const snapshot = options.scene.snapshot();
    const escapeFromMenu = event.key === 'Escape' && snapshot.phase === 'Menu';
    const intent = gameIntentForKey(event, document.activeElement === canvas || escapeFromMenu, isEditable(event.target));
    if (!intent || (event.repeat && intent !== 'next' && intent !== 'previous')) return;
    if (intent === 'next' || intent === 'previous') {
      const stacks = options.scene.selectableStacks();
      if (!stacks.length) return;
      const direction = intent === 'next' ? 1 : -1;
      const found = stacks.findIndex(stack => stack.id === options.scene.selectedStackId());
      const current = found < 0 ? (direction === 1 ? stacks.length - 1 : 0) : found;
      const selected = stacks[(current + direction + stacks.length) % stacks.length]!;
      if (options.scene.selectStack(selected.id)) {
        event.preventDefault();
        options.announce(`Выбрана стопка ${stacks.indexOf(selected) + 1} из ${stacks.length}.`);
      }
    } else if (intent === 'launch' && snapshot.phase === 'Idle') {
      const id = options.scene.selectedStackId();
      if (id && options.scene.launchStack(id)) { event.preventDefault(); options.announce('Ход выполнен.'); }
    } else if (intent === 'undo' && snapshot.canUndo) {
      options.scene.undo(); event.preventDefault(); options.announce('Ход отменён.');
    } else if (intent === 'restart' && ['Idle', 'Won'].includes(snapshot.phase)) {
      options.reset(); event.preventDefault(); options.announce('Уровень сброшен.');
    } else if (intent === 'menu' && options.scene.toggleMenu()) {
      event.preventDefault(); options.announce('Меню открыто. Escape — вернуться в игру.');
    }
  }
  target.addEventListener('keydown', down);
  return Object.freeze({ dispose() { target.removeEventListener('keydown', down); } });
}
