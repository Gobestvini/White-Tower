export type AudioEffect = 'ui' | 'launch' | 'merge' | 'settle' | 'turn' | 'undo' | 'victory';
export type AudioTone = Readonly<{ startHz: number; endHz: number; durationMs: number; waveform: OscillatorType; gain: number }>;

// Project-authored procedural sounds: the tone parameters are the lossless source and are synthesized on demand.
export const AUDIO_EFFECTS: Readonly<Record<AudioEffect, AudioTone>> = Object.freeze({
  ui: Object.freeze({ startHz: 620, endHz: 540, durationMs: 34, waveform: 'sine', gain: 0.16 }),
  launch: Object.freeze({ startHz: 300, endHz: 365, durationMs: 72, waveform: 'triangle', gain: 0.18 }),
  merge: Object.freeze({ startHz: 540, endHz: 880, durationMs: 115, waveform: 'sine', gain: 0.22 }),
  settle: Object.freeze({ startHz: 230, endHz: 105, durationMs: 190, waveform: 'triangle', gain: 0.24 }),
  turn: Object.freeze({ startHz: 420, endHz: 535, durationMs: 84, waveform: 'sine', gain: 0.16 }),
  undo: Object.freeze({ startHz: 455, endHz: 305, durationMs: 130, waveform: 'triangle', gain: 0.2 }),
  victory: Object.freeze({ startHz: 520, endHz: 790, durationMs: 230, waveform: 'sine', gain: 0.2 }),
});
