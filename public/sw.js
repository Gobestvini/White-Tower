const CACHE_PREFIX = `white-tower-${new URL(self.registration.scope).pathname}-`;
const CACHE_NAME = `${CACHE_PREFIX}1.3.0-pages`;
const gameUrl = path => new URL(path.replace(/^\//, ''), self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(gameUrl('/content/catalog.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Campaign catalog could not be fetched.');
    const catalog = await response.json();
    if (!Array.isArray(catalog.levels) || catalog.levels.length !== 120) throw new Error('Campaign catalog is incomplete.');
    const shell = await (await fetch(gameUrl('/'))).text();
    const assets = [...shell.matchAll(/(?:src|href)="([^\"]+)"/g)]
      .map(match => new URL(match[1], self.registration.scope).href)
      .filter(url => url.startsWith(gameUrl('/assets/')));
    const cache = await caches.open(CACHE_NAME);
    try {
      const artResponse = await fetch(gameUrl('/art-assets.json'), { cache: 'no-store' });
      if (!artResponse.ok) throw new Error('UI asset manifest could not be fetched.');
      const art = await artResponse.json();
      if (!Array.isArray(art) || art.some(file => typeof file !== 'string' || !file.startsWith('/assets/'))) throw new Error('UI asset manifest is invalid.');
      await cache.addAll([...['/','/index.html','/manifest.webmanifest','/white-tower.svg','/content/catalog.json','/art-assets.json',...art,...catalog.levels.map(level=>level.path)].map(gameUrl),...assets]);
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && request.url.startsWith(gameUrl('/assets/'))) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return new Response('This White Tower content is not available offline yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
