import { validateLevel, type Level } from '../game/level-schema.js';
import { contentUrl } from './url.js';

export type CatalogEntry = Readonly<{ id: string; path: string; sha256: string }>;
export type ContentCatalog = Readonly<{ schemaVersion: 1; contentVersion: string; levels: readonly CatalogEntry[] }>;
export type ContentErrorCode = 'network' | 'catalog' | 'missing-level' | 'checksum' | 'json' | 'schema' | 'identity';
const verifiedLevels = new Map<string, Level>();

export class ContentLoadError extends Error {
  constructor(readonly code: ContentErrorCode, message: string) {
    super(message);
    this.name = 'ContentLoadError';
  }
}

function parseCatalog(raw: unknown): ContentCatalog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ContentLoadError('catalog', 'Catalog must be an object.');
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || typeof candidate.contentVersion !== 'string' || !Array.isArray(candidate.levels) || candidate.levels.length < 1 || candidate.levels.length > 120)
    throw new ContentLoadError('catalog', 'Catalog version or level list is invalid (expected 1–120 entries).');
  const ids = new Set<string>();
  const levels: CatalogEntry[] = [];
  candidate.levels.forEach((item: unknown, index: number) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new ContentLoadError('catalog', `Entry ${index} must be an object.`);
    const entry = item as Record<string, unknown>;
    const expectedId = `level-${String(index + 1).padStart(3, '0')}`;
    const expectedPath = `/content/levels/${String(index + 1).padStart(3, '0')}.json`;
    if (entry.id !== expectedId || entry.path !== expectedPath || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256))
      throw new ContentLoadError('catalog', `Entry ${index} has invalid order, path or checksum.`);
    if (ids.has(expectedId)) throw new ContentLoadError('catalog', `Duplicate level ${expectedId}.`);
    ids.add(expectedId);
    levels.push(Object.freeze({ id: expectedId, path: expectedPath, sha256: entry.sha256 }));
  });
  return Object.freeze({ schemaVersion: 1, contentVersion: candidate.contentVersion, levels: Object.freeze(levels) });
}

export async function loadCatalog(url = contentUrl('/content/catalog.json'), fetcher: typeof fetch = fetch): Promise<ContentCatalog> {
  let response: Response;
  try { response = await fetcher(url); }
  catch (error) { throw new ContentLoadError('network', error instanceof Error ? error.message : String(error)); }
  if (!response.ok) throw new ContentLoadError('network', `Catalog request failed (${response.status}).`);
  let raw: unknown;
  try { raw = await response.json(); }
  catch (error) { throw new ContentLoadError('json', error instanceof Error ? error.message : 'Invalid catalog JSON.'); }
  return parseCatalog(raw);
}

export async function loadLevelById(catalog: ContentCatalog, id: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Level> {
  const entry = catalog.levels.find(item => item.id === id);
  if (!entry) throw new ContentLoadError('missing-level', `Level ${id} is not in the catalog.`);
  const cacheKey = `${catalog.contentVersion}:${entry.sha256}`;
  const cached = verifiedLevels.get(cacheKey);
  if (cached) return cached;
  let response: Response;
  try { response = await fetcher(contentUrl(entry.path), signal ? { signal } : undefined); }
  catch (error) { throw new ContentLoadError('network', error instanceof Error ? error.message : String(error)); }
  if (!response.ok) throw new ContentLoadError('network', `Level request failed (${response.status}).`);
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await response.arrayBuffer()); }
  catch (error) { throw new ContentLoadError('network', error instanceof Error ? error.message : `Could not read ${id}.`); }
  let digest: ArrayBuffer;
  try { digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource); }
  catch (error) { throw new ContentLoadError('checksum', error instanceof Error ? error.message : 'SHA-256 is unavailable.'); }
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== entry.sha256) throw new ContentLoadError('checksum', `Checksum mismatch for ${id}.`);
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)); }
  catch (error) { throw new ContentLoadError('json', error instanceof Error ? error.message : `Invalid JSON for ${id}.`); }
  const result = validateLevel(raw);
  if (!result.ok) throw new ContentLoadError('schema', result.errors.map(item => `${item.path}: ${item.message}`).join('; '));
  if (result.value.id !== entry.id) throw new ContentLoadError('identity', `Catalog ID does not match level ${id}.`);
  verifiedLevels.set(cacheKey, result.value);
  return result.value;
}

export function loadLevelAt(catalog: ContentCatalog, index: number, fetcher: typeof fetch = fetch): Promise<Level> {
  const entry = catalog.levels[index];
  if (!entry) return Promise.reject(new ContentLoadError('missing-level', `No level at index ${index}.`));
  return loadLevelById(catalog, entry.id, fetcher);
}
