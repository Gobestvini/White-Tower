/// <reference types="vite/client" />

/** Catalog paths are rooted at the game, even when hosted in a project subdirectory. */
export function contentUrl(path: string, base = import.meta.env?.BASE_URL ?? '/'): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
