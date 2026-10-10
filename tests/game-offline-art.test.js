import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function workerFixture(art, failArtwork = false, base = '/') {
  const handlers = {}; const added = []; const deleted = [];
  const context = vm.createContext({
    URL,
    self: { registration: { scope: `https://game.example${base}` }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    fetch: async url => ({ ok: true,
      json: async () => url.endsWith('/art-assets.json') ? art : { levels: Array.from({ length: 120 }, (_, i) => ({ path: `/content/levels/${i + 1}.json` })) },
      text: async () => `<script src="${base}assets/app.js"></script><link href="${base}assets/app.css">`,
    }),
    caches: {
      open: async () => ({ addAll: async urls => { added.push(...urls); if (failArtwork) throw Error('Network interrupted'); } }),
      delete: async name => { deleted.push(name); },
    },
  });
  vm.runInContext(fs.readFileSync('public/sw.js', 'utf8'), context);
  return { added, deleted, install() { let pending; handlers.install({ waitUntil: work => { pending = work; } }); return pending; } };
}

test('offline install caches artwork for screens never opened, alongside all campaign levels', async () => {
  const worker = workerFixture(['/assets/gameplay.jpg', '/assets/settings.png', '/assets/campaign.png']);
  await worker.install();
  for (const url of ['/assets/settings.png', '/assets/campaign.png', '/art-assets.json', '/content/levels/120.json', '/assets/app.js', '/assets/app.css']) assert.ok(worker.added.includes(`https://game.example${url}`), url);
  assert.equal(worker.deleted.length, 0);
});

test('project hosting caches shell, artwork and all levels inside its own scope', async () => {
  const worker = workerFixture(['/assets/settings.png'], false, '/White-Tower/');
  await worker.install();
  for (const path of ['', 'index.html', 'assets/settings.png', 'assets/app.js', 'assets/app.css', 'content/levels/120.json']) {
    assert.ok(worker.added.includes(`https://game.example/White-Tower/${path}`), path);
  }
  assert.ok(worker.added.every(url => url.startsWith('https://game.example/White-Tower/')));
});

test('an incomplete artwork install is discarded rather than activated as an offline shell', async () => {
  const worker = workerFixture(['/assets/settings.png'], true);
  await assert.rejects(worker.install(), /Network interrupted/);
  assert.equal(worker.deleted.length, 1);
});

test('offline install rejects invalid artwork paths before populating its cache', async () => {
  const worker = workerFixture(['https://untrusted.example/art.png']);
  await assert.rejects(worker.install(), /UI asset manifest is invalid/);
  assert.equal(worker.added.length, 0);
  assert.equal(worker.deleted.length, 1);
});
