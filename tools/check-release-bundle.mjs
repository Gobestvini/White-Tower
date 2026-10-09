import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dist = resolve('dist');
const editorHtml = join(dist, 'tools', 'level-editor');
try { await stat(editorHtml); throw new Error('Internal level editor was included in the production bundle.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const scripts = (await readdir(join(dist, 'assets'))).filter(file => file.endsWith('.js'));
for (const script of scripts) {
  const source = await readFile(join(dist, 'assets', script), 'utf8');
  if (source.includes('editor-draft') || source.includes('Import and validate') || source.includes('tools/level-editor')) throw new Error(`Editor code leaked into ${script}.`);
}
console.log(`Production bundle contains ${scripts.length} application scripts and no internal editor entry.`);
