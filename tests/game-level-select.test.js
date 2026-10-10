import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelSelect } from '../src/ui/level-select.ts';

// Minimal DOM surface for the chooser; no renderer or browser globals are needed.
class Element extends EventTarget {
  children = []; attributes = {}; textContent = ''; className = ''; disabled = false;
  classList = { add: value => { this.className += ` ${value}`; } };
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() { document.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}

test('level chooser pages all 120 levels and preserves locks, selection and completion', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new Element(), activeElement: null };
  try {
    const root = new Element(); const selected = [];
    const chooser = createLevelSelect(root, { select: id => selected.push(id), back() {} });
    const input = { language: 'en', choices: Array.from({ length: 120 }, (_, i) => ({ id: `level-${String(i + 1).padStart(3, '0')}`, index: i + 1 })), unlockedLevel: 2, completed: ['level-001'], selectedLevelId: 'level-002' };
    chooser.update(input);
    const [, progress, grid, pages] = root.children;
    const [previous, label, next] = pages.children;
    assert.equal(grid.children.length, 30);
    assert.equal(progress.textContent, '1 of 120 completed');
    assert.match(grid.children[0].className, /is-completed/);
    assert.match(grid.children[1].className, /is-selected/);
    grid.children[1].click(); grid.children[2].click();
    assert.deepEqual(selected, ['level-002'], 'locked cells cannot select a level');
    assert.equal(previous.disabled, true);
    next.click();
    assert.equal(label.textContent, '31–60 / 120');
    assert.equal(grid.children[0].textContent, '31 🔒');
    chooser.update({ ...input, language: 'ru' });
    assert.equal(label.textContent, '31–60 / 120', 'locale updates preserve the browsed page');
    next.click(); next.click(); next.click();
    assert.equal(label.textContent, '91–120 / 120');
    assert.equal(next.disabled, true, 'the last page cannot advance past the campaign');
    chooser.update({ ...input, unlockedLevel: 120, selectedLevelId: 'level-120' });
    assert.equal(grid.children.at(-1).disabled, false);
    assert.match(grid.children.at(-1).className, /is-selected/);
    grid.children.at(-1).click();
    assert.equal(selected.at(-1), 'level-120');
  } finally { globalThis.document = previousDocument; }
});
