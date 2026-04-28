import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSceneAreaLabel } from '../src/lib/sceneAreaLabel';

test('decodes bedroom area status code bits', () => {
  const decoded = decodeSceneAreaLabel('1AXBEDROOM');
  assert.ok(decoded);
  assert.equal(decoded?.statusHex, '1A');
  assert.equal(decoded?.sceneId, 'bedroom');
  assert.equal(decoded?.bitStates[1].enabled, true);
  assert.equal(decoded?.bitStates[3].enabled, true);
  assert.equal(decoded?.bitStates[4].enabled, true);
});

test('invalid area label returns null', () => {
  assert.equal(decodeSceneAreaLabel('hello-world'), null);
});

