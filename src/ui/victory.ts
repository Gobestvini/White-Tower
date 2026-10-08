import type { GameSnapshot } from '../game/controller.js';

export function createVictoryOverlay(root: HTMLElement, actions: { undo(): void; next(): void }) {
  const layer = document.createElement('section');
  layer.className = 'victory-layer';
  layer.setAttribute('aria-label', 'Level completed');
  layer.innerHTML = `
    <div class="victory-shade" aria-hidden="true"></div>
    <div class="victory-ribbon" aria-live="polite"><span>LEVEL</span><span>COMPLETED!</span></div>
    <p class="campaign-end" role="status"></p>`;
  root.append(layer);
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'next-button';
  nextButton.setAttribute('aria-label', 'Next level');
  nextButton.innerHTML = '<span>NEXT</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  root.append(nextButton);
  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.className = 'victory-undo';
  undoButton.setAttribute('aria-label', 'Undo last move');
  undoButton.innerHTML = '↶ <span>UNDO</span>';
  root.append(undoButton);
  const message = layer.querySelector<HTMLElement>('.campaign-end')!;
  undoButton.addEventListener('click', actions.undo);
  nextButton.addEventListener('click', actions.next);
  let generation = -1;
  let elapsed = 0;
  let shown = false;
  let previousPhase = '';

  function update(snapshot: GameSnapshot, dt: number, nextPending = false, campaignMessage = ''): void {
    if (snapshot.phase !== previousPhase || snapshot.generationId !== generation) {
      previousPhase = snapshot.phase;
      generation = snapshot.generationId;
      if (snapshot.phase === 'Won') { elapsed = 0; shown = false; }
      else { elapsed = 0; shown = false; }
    }
    if (snapshot.phase === 'Won' && !shown) {
      elapsed += Math.max(0, Math.min(dt, 0.1));
      if (elapsed >= 0.3) shown = true;
    }
    const visible = snapshot.phase === 'Won' && shown;
    layer.classList.toggle('is-visible', visible);
    layer.setAttribute('aria-hidden', String(!visible));
    nextButton.hidden = !visible;
    undoButton.hidden = !visible;
    nextButton.disabled = nextPending || snapshot.phase !== 'Won';
    nextButton.querySelector('span')!.textContent = nextPending ? 'LOADING…' : 'NEXT';
    undoButton.disabled = snapshot.phase !== 'Won' || !snapshot.canUndo;
    message.textContent = campaignMessage;
  }

  function dispose(): void {
    undoButton.removeEventListener('click', actions.undo);
    nextButton.removeEventListener('click', actions.next);
    layer.remove();
    undoButton.remove();
  }
  return Object.freeze({ update, dispose });
}
