import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio/audio.ts';

function fakeAdapter() {
  const calls = [];
  return {
    calls,
    resume: async () => calls.push('resume'),
    suspend: async () => calls.push('suspend'),
    close: async () => calls.push('close'),
    playTone(tone, volume, ended) {
      const voice = { stopped: false, stop() { this.stopped = true; calls.push('stop'); } };
      calls.push({ tone, volume, voice, ended });
      return voice;
    },
  };
}

test('audio waits for a user gesture and honors mute and bounded volume', async () => {
  const adapter = fakeAdapter(); let creations = 0;
  const audio = createAudio({ createAdapter: () => { creations++; return adapter; } });
  assert.equal(audio.play('launch'), false);
  assert.equal(creations, 0, 'no AudioContext is created before user input');
  assert.equal(await audio.unlock(), true);
  assert.equal(creations, 1);
  assert.equal(audio.play('launch'), true);
  assert.equal(adapter.calls.find(item => typeof item === 'object').volume, 0.4);
  audio.configure({ soundEnabled: false, soundVolume: 1 });
  assert.equal(audio.play('merge'), false);
  audio.configure({ soundEnabled: true, soundVolume: 2 });
  assert.equal(audio.snapshot().volume, 1, 'volume is clamped');
  assert.equal(audio.play('merge'), true);
  await audio.dispose();
});

test('rate limit, voice limit and hidden state stop output without queuing it on resume', async () => {
  const adapter = fakeAdapter(); let timestamp = 0;
  const audio = createAudio({ createAdapter: () => adapter, now: () => timestamp, rateLimitMs: 40, maxVoices: 2 });
  await audio.unlock();
  assert.equal(audio.play('merge'), true);
  assert.equal(audio.play('merge'), false, 'same sound cannot crackle from rapid repeats');
  timestamp += 50;
  assert.equal(audio.play('turn'), true);
  timestamp += 50;
  assert.equal(audio.play('undo'), true);
  assert.equal(audio.snapshot().activeVoices, 2);
  assert.equal(adapter.calls.filter(item => item === 'stop').length, 1, 'oldest voice is stolen at the cap');
  await audio.setVisible(false);
  assert.equal(audio.play('victory'), false, 'hidden effects are dropped');
  await audio.setVisible(true);
  assert.equal(audio.snapshot().activeVoices, 0, 'resume does not replay queued audio');
  assert.equal(adapter.calls.filter(item => item === 'resume').length, 2);
  await audio.dispose();
  assert.equal(adapter.calls.at(-1), 'close');
});

test('AudioContext and playback failures remain optional and disposal releases voices', async () => {
  const unavailable = createAudio({ createAdapter: () => { throw new Error('unavailable'); } });
  assert.equal(await unavailable.unlock(), false);
  assert.equal(unavailable.play('launch'), false);
  await unavailable.dispose();

  const adapter = fakeAdapter();
  const audio = createAudio({ createAdapter: () => adapter });
  await audio.unlock();
  assert.equal(audio.play('ui'), true);
  const voice = adapter.calls.find(item => typeof item === 'object').voice;
  await audio.dispose();
  assert.equal(voice.stopped, true);
  assert.equal(audio.play('ui'), false);
});
