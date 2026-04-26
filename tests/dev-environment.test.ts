import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseGodModeDebugForHost } from '../src/lib/devEnvironment';

test('localhost enables debug without query token', () => {
  assert.equal(canUseGodModeDebugForHost('localhost', ''), true);
  assert.equal(canUseGodModeDebugForHost('127.0.0.1', ''), true);
});

test('netlify non-production host requires matching debug query token', () => {
  assert.equal(canUseGodModeDebugForHost('deploy-preview-12--cavern.netlify.app', ''), false);
  assert.equal(canUseGodModeDebugForHost('deploy-preview-12--cavern.netlify.app', '?debugmode=wrong'), false);
  assert.equal(canUseGodModeDebugForHost('deploy-preview-12--cavern.netlify.app', '?debugmode=godmode'), true);
});

test('production-like hosts remain disabled', () => {
  assert.equal(canUseGodModeDebugForHost('cavern.netlify.app', '?debugmode=godmode'), false);
  assert.equal(canUseGodModeDebugForHost('example.com', '?debugmode=godmode'), false);
});

