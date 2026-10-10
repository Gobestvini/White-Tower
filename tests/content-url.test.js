import test from 'node:test';
import assert from 'node:assert/strict';
import { contentUrl } from '../src/content/url.ts';

test('content paths stay under the deployment directory', () => {
  assert.equal(contentUrl('/content/catalog.json', '/'), '/content/catalog.json');
  assert.equal(contentUrl('/content/levels/120.json', '/White-Tower/'), '/White-Tower/content/levels/120.json');
  assert.equal(contentUrl('sw.js', '/White-Tower/'), '/White-Tower/sw.js');
});
