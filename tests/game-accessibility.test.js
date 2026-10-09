import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInitialState, validateLevel } from '../src/game/level-schema.js';
import { describeBoard, keyboardAnnouncement } from '../src/ui/accessibility.ts';

const example = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/knowledge/white-tower/levels_examples.json', import.meta.url)), 'utf8')).levels[0];
const level = validateLevel(example);
if (!level.ok) throw new Error('Accessibility fixture did not validate');
const state = createInitialState(level.value);
const activeStacks = [{ stack: state.stacks[0], direction: 'SE' }];

test('board description includes progress, coordinates, height, direction and keyboard selection', () => {
  const english = describeBoard({ level: level.value, state, levelNumber: 1, language: 'en', selectedStackId: state.stacks[0].id, activeStacks });
  assert.match(english, /Level 1\. 0 of 4 tiles gathered\. Selected arrow 1: coordinates 0, 0, height 1, direction SE\./);
  const russian = describeBoard({ level: level.value, state, levelNumber: 1, language: 'ru', activeStacks });
  assert.match(russian, /Уровень 1\. Собрано 0 из 4 плиток\. Стрелка 1: координаты 0, 0, высота 1, направление SE\./);
});

test('keyboard announcements use the selected locale and concise action text', () => {
  assert.equal(keyboardAnnouncement('en', 'selection', 2, 3), 'Selected stack 2 of 3.');
  assert.equal(keyboardAnnouncement('ru', 'undo'), 'Ход отменён.');
});
