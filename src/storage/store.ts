export type StoreMode = 'indexeddb' | 'localStorage' | 'memory';
export type StoreAdapter = Readonly<{ mode: StoreMode; read(): Promise<unknown>; write(value: unknown): Promise<void> }>;
const KEY = 'white-tower.save.v1';

function indexedDbAdapter(): Promise<StoreAdapter> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open('white-tower', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('save')) request.result.createObjectStore('save'); };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      resolve({ mode: 'indexeddb',
        read: () => new Promise((res, rej) => { const tx = db.transaction('save', 'readonly'); const req = tx.objectStore('save').get(KEY); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }),
        write: value => new Promise((res, rej) => { const tx = db.transaction('save', 'readwrite'); tx.objectStore('save').put(value, KEY); tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error ?? new Error('IndexedDB write failed')); }),
      });
    };
  });
}

function localStorageAdapter(): StoreAdapter {
  if (typeof localStorage === 'undefined') throw new Error('localStorage unavailable');
  // Probe access now so security-denied storage falls through to memory.
  const probe = `${KEY}.probe`; localStorage.setItem(probe, '1'); localStorage.removeItem(probe);
  return { mode: 'localStorage', async read() { const value = localStorage.getItem(KEY); return value === null ? undefined : JSON.parse(value); }, async write(value) { localStorage.setItem(KEY, JSON.stringify(value)); } };
}

export function createStore(options: { adapters?: readonly (() => Promise<StoreAdapter> | StoreAdapter)[] } = {}) {
  const factories = options.adapters ?? [indexedDbAdapter, localStorageAdapter];
  let adapter: StoreAdapter = { mode: 'memory', async read() { return memory; }, async write(value) { memory = value; } };
  let adapterIndex = -1;
  let memory: unknown;
  let mode: StoreMode = 'memory';
  let writeQueue = Promise.resolve();
  let unavailableReason = '';
  const ready = (async () => {
    for (let index = 0; index < factories.length; index++) {
      try { const candidate = await factories[index]!(); await candidate.read(); adapter = candidate; adapterIndex = index; mode = candidate.mode; break; }
      catch (error) { unavailableReason = error instanceof Error ? error.message : String(error); }
    }
    return mode;
  })();
  async function read(): Promise<unknown> {
    await ready;
    try { const value = await adapter.read(); memory = value; return value; }
    catch (error) {
      unavailableReason = error instanceof Error ? error.message : String(error);
      for (let index = adapterIndex + 1; index < factories.length; index++) {
        try { const candidate = await factories[index]!(); const value = await candidate.read(); adapter = candidate; adapterIndex = index; mode = candidate.mode; memory = value; return value; }
        catch (fallbackError) { unavailableReason = fallbackError instanceof Error ? fallbackError.message : String(fallbackError); }
      }
      adapter = { mode: 'memory', async read() { return memory; }, async write(value) { memory = value; } }; mode = 'memory'; return memory;
    }
  }
  function write(value: unknown): Promise<void> {
    writeQueue = writeQueue.then(async () => {
      await ready;
      memory = value;
      try { await adapter.write(value); }
      catch (error) {
        unavailableReason = error instanceof Error ? error.message : String(error);
        let stored = false;
        for (let index = adapterIndex + 1; index < factories.length; index++) {
          try {
            const candidate = await factories[index]!();
            await candidate.read();
            await candidate.write(value);
            adapter = candidate; adapterIndex = index; mode = candidate.mode; stored = true; break;
          } catch (fallbackError) { unavailableReason = fallbackError instanceof Error ? fallbackError.message : String(fallbackError); }
        }
        if (!stored) { adapter = { mode: 'memory', async read() { return memory; }, async write(next) { memory = next; } }; adapterIndex = factories.length; mode = 'memory'; }
      }
    });
    return writeQueue;
  }
  return Object.freeze({ ready, read, write, mode: () => mode, memoryOnly: () => mode === 'memory', unavailableReason: () => unavailableReason, flush: () => writeQueue });
}
