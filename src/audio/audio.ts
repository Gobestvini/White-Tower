import { AUDIO_EFFECTS, type AudioEffect, type AudioTone } from './events.js';

export type AudioVoice = Readonly<{ stop(): void }>;
export type AudioAdapter = Readonly<{
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  playTone(tone: AudioTone, masterVolume: number, ended: () => void): AudioVoice;
}>;
export type AudioPreferences = Readonly<{ soundEnabled: boolean; soundVolume: number }>;

export function createWebAudioAdapter(): AudioAdapter {
  if (typeof AudioContext === 'undefined') throw new Error('Web Audio is unavailable.');
  const context = new AudioContext();
  return Object.freeze({
    resume: () => context.resume(), suspend: () => context.suspend(), close: () => context.close(),
    playTone(tone, masterVolume, ended) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      const duration = tone.durationMs / 1000;
      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(tone.startHz, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endHz), start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, tone.gain * masterVolume), start + Math.min(0.012, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); ended(); };
      oscillator.start(start); oscillator.stop(start + duration + 0.01);
      return Object.freeze({ stop() { try { oscillator.stop(); } catch { /* already stopped */ } } });
    },
  });
}

export function createAudio(options: Readonly<{
  createAdapter?: () => AudioAdapter;
  maxVoices?: number;
  rateLimitMs?: number;
  now?: () => number;
}> = {}) {
  const createAdapter = options.createAdapter ?? createWebAudioAdapter;
  const maxVoices = Math.max(1, options.maxVoices ?? 5);
  const rateLimitMs = Math.max(0, options.rateLimitMs ?? 40);
  const now = options.now ?? (() => performance.now());
  let adapter: AudioAdapter | undefined;
  let enabled = true;
  let volume = 0.4;
  let visible = true;
  let disposed = false;
  let unlocked = false;
  let resumed = false;
  const active = new Set<AudioVoice>();
  const lastPlayed = new Map<AudioEffect, number>();

  function stopVoices(): void {
    for (const voice of active) { try { voice.stop(); } catch { /* playback failure is non-fatal */ } }
    active.clear();
  }
  function configure(preferences: AudioPreferences): void {
    enabled = preferences.soundEnabled === true;
    volume = Number.isFinite(preferences.soundVolume) ? Math.max(0, Math.min(1, preferences.soundVolume)) : 0.4;
    if (!enabled || volume === 0) stopVoices();
  }
  async function unlock(): Promise<boolean> {
    if (disposed || !visible || !enabled || volume === 0) return false;
    if (unlocked && adapter && resumed) return true;
    try {
      if (!adapter) adapter = createAdapter();
      unlocked = true;
      await adapter.resume();
      resumed = true;
      return visible;
    } catch { resumed = false; return false; }
  }
  function play(effect: AudioEffect): boolean {
    if (disposed || !visible || !enabled || volume === 0 || !unlocked || !adapter) return false;
    const timestamp = now();
    if (timestamp - (lastPlayed.get(effect) ?? -Infinity) < rateLimitMs) return false;
    lastPlayed.set(effect, timestamp);
    if (active.size >= maxVoices) {
      const oldest = active.values().next().value as AudioVoice | undefined;
      if (oldest) { try { oldest.stop(); } catch { /* playback failure is non-fatal */ } active.delete(oldest); }
    }
    try {
      let voice: AudioVoice | undefined;
      voice = adapter.playTone(AUDIO_EFFECTS[effect], volume, () => { if (voice) active.delete(voice); });
      active.add(voice);
      return true;
    } catch { return false; }
  }
  async function setVisible(value: boolean): Promise<void> {
    if (disposed || visible === value) return;
    visible = value;
    if (!visible) {
      resumed = false;
      stopVoices();
      try { await adapter?.suspend(); } catch { /* visibility must not affect game input */ }
    } else if (unlocked && enabled && volume > 0) {
      try { await adapter?.resume(); resumed = true; } catch { resumed = false; /* a later user gesture can retry */ }
    }
  }
  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true; stopVoices(); unlocked = false; resumed = false;
    try { await adapter?.close(); } catch { /* cleanup is best-effort */ }
    adapter = undefined;
  }
  return Object.freeze({ configure, unlock, play, setVisible, dispose, snapshot: () => Object.freeze({ enabled, volume, visible, unlocked, activeVoices: active.size, disposed }) });
}
