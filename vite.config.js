import { defineConfig } from 'vite';
export default defineConfig({ base: '/', plugins: [{
  name: 'offline-art-manifest',
  generateBundle(_options, bundle) {
    // Precache lazy CSS/image dependencies too, including screens not yet opened.
    this.emitFile({ type: 'asset', fileName: 'art-assets.json', source: JSON.stringify(Object.keys(bundle).filter(file => /\.(?:png|jpg|webp|svg)$/.test(file)).map(file => `/${file}`)) });
  },
}] });
