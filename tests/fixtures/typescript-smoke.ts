export interface SmokeResult {
  readonly status: 'ready';
  readonly count: number;
}

export function makeSmokeResult(count: number): SmokeResult {
  return { status: 'ready', count };
}
