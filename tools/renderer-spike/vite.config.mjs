import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root,
  base: '/',
  build: {
    outDir: path.join(root, 'artifacts/renderer-spike/build'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(root, 'tools/renderer-spike/index.html') },
  },
});
