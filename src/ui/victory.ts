import type { GameSnapshot } from '../game/controller.js';
import { t, type Language } from './i18n.js';

export function createVictoryOverlay(root: HTMLElement, actions: { undo(): void; next(): void; chooseLevels(): void }) {
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
  nextButton.innerHTML = '<span>NEXT</span>';
  root.append(nextButton);
  const chooseButton = document.createElement('button');
  chooseButton.type = 'button'; chooseButton.className = 'next-button victory-choose';
  chooseButton.addEventListener('click', actions.chooseLevels); root.append(chooseButton);
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
  let language: Language = 'en';

  function update(snapshot: GameSnapshot, dt: number, nextPending = false, campaignMessage = '', campaignComplete = false): void {
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
    layer.lang = language;
    nextButton.setAttribute('aria-label', language === 'ru' ? 'Следующий уровень' : 'Next level');
    chooseButton.setAttribute('aria-label', t(language, 'chooseLevel'));
    undoButton.setAttribute('aria-label', language === 'ru' ? 'Отменить последний ход' : 'Undo last move');
    layer.querySelector('.victory-ribbon span')!.textContent = language === 'en' ? 'LEVEL' : 'УРОВЕНЬ';
    layer.querySelector('.victory-ribbon span:last-child')!.textContent = t(language, 'win');
    nextButton.querySelector('span')!.textContent = nextPending ? '…' : t(language, 'next');
    chooseButton.textContent = t(language, 'chooseLevel');
    undoButton.querySelector('span')!.textContent = t(language, 'undo');
    layer.classList.toggle('is-visible', visible);
    layer.setAttribute('aria-hidden', String(!visible));
    nextButton.hidden = !visible;
    chooseButton.hidden = !visible || !campaignComplete;
    nextButton.hidden = !visible || campaignComplete;
    undoButton.hidden = !visible;
    nextButton.disabled = nextPending || snapshot.phase !== 'Won';
    undoButton.disabled = snapshot.phase !== 'Won' || !snapshot.canUndo;
    message.textContent = campaignComplete ? t(language, 'campaignComplete') : campaignMessage;
  }

  function dispose(): void {
    undoButton.removeEventListener('click', actions.undo);
    nextButton.removeEventListener('click', actions.next);
    chooseButton.removeEventListener('click', actions.chooseLevels);
    layer.remove(); chooseButton.remove();
    undoButton.remove();
  }
  return Object.freeze({ update, setLanguage(value: Language) { language = value; }, dispose });
}
