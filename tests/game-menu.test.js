import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, t } from '../src/ui/i18n.ts';

test('settings are normalized to supported locale, accessibility and renderer choices', () => {
  assert.deepEqual(parseSettings(undefined), { language: 'en', reducedMotion: false, highContrast: false, rendererMode: 'auto', tutorialCompleted: false });
  assert.deepEqual(parseSettings({ language: 'ru', reducedMotion: true, highContrast: true, rendererMode: '2d', tutorialCompleted: true, unknown: true }), { language: 'ru', reducedMotion: true, highContrast: true, rendererMode: '2d', tutorialCompleted: true });
  assert.deepEqual(parseSettings({ language: 'fr', reducedMotion: 'yes', highContrast: 1, rendererMode: 'unsupported' }), { language: 'en', reducedMotion: false, highContrast: false, rendererMode: 'auto', tutorialCompleted: false });
});

test('both supported locales provide core menu and gameplay action labels', () => {
  for (const language of ['en', 'ru']) {
    for (const key of ['settings', 'back', 'levels', 'clearProgress', 'clearQuestion', 'cancel', 'locked', 'completed', 'undo', 'next', 'win', 'action.undo', 'action.next', 'win.title', 'tutorial.tap', 'hint.undo', 'game.stuck', 'action.retry', 'highContrast', 'a11y.selection', 'a11y.move', 'a11y.undo', 'a11y.restart', 'a11y.menu']) {
      assert.ok(t(language, key).length > 0, `${language}.${key} has a translation`);
    }
  }
  assert.equal(t('en', 'settings'), 'Settings');
  assert.equal(t('ru', 'settings'), 'Настройки');
});
