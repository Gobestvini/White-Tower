import { clientToArtboard } from '../render/projection.js';

export type PointerInputOptions = Readonly<{
  pickStack(point: Readonly<{ x: number; y: number }>): string | undefined;
  activate(stackId: string): boolean;
  maxMovement?: number;
  duplicateWindowMs?: number;
  environment?: Readonly<{ windowTarget?: EventTarget; documentTarget?: EventTarget & { hidden?: boolean } }>;
}>;

export function createPointerInput(canvas: HTMLCanvasElement, options: PointerInputOptions) {
  const maxMovement = options.maxMovement ?? 12;
  const duplicateWindowMs = options.duplicateWindowMs ?? 220;
  const windowTarget = options.environment?.windowTarget ?? window;
  const documentTarget = options.environment?.documentTarget ?? document;
  let active: { pointerId: number; stackId: string; x: number; y: number } | undefined;
  let lastActivated: { stackId: string; at: number } | undefined;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  function pick(event: PointerEvent): string | undefined {
    const point = clientToArtboard(event.clientX, event.clientY, canvas.getBoundingClientRect());
    return point ? options.pickStack(point) : undefined;
  }
  function down(event: PointerEvent): void {
    if (!event.isPrimary || active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const stackId = pick(event);
    if (!stackId) return;
    active = { pointerId: event.pointerId, stackId, x: event.clientX, y: event.clientY };
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Browser may release a pointer before capture. */ }
  }
  function up(event: PointerEvent): void {
    if (!active || active.pointerId !== event.pointerId) return;
    const initial = active;
    active = undefined;
    event.preventDefault();
    const moved = Math.hypot(event.clientX - initial.x, event.clientY - initial.y);
    const now = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
    const duplicate = lastActivated?.stackId === initial.stackId && now - lastActivated.at < duplicateWindowMs;
    if (moved <= maxMovement && pick(event) === initial.stackId && !duplicate && options.activate(initial.stackId))
      lastActivated = { stackId: initial.stackId, at: now };
  }
  function cancel(event?: PointerEvent): void {
    if (event && active?.pointerId !== event.pointerId) return;
    const pointerId = active?.pointerId;
    active = undefined;
    if (pointerId !== undefined) {
      try { if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch { /* Already released. */ }
    }
  }
  const onBlur = () => cancel();
  const onVisibility = () => { if (documentTarget.hidden) cancel(); };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  windowTarget.addEventListener('blur', onBlur);
  documentTarget.addEventListener('visibilitychange', onVisibility);
  return Object.freeze({
    cancel,
    dispose() {
      cancel();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      windowTarget.removeEventListener('blur', onBlur);
      documentTarget.removeEventListener('visibilitychange', onVisibility);
      canvas.style.touchAction = previousTouchAction;
    },
  });
}
