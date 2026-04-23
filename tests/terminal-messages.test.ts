import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTerminalMessage } from '../src/lib/terminalMessages';
import { FATAL_PREFIX, SYS_PREFIX } from '../src/lib/gameEngine';

test('classifies command lines', () => {
  const msg = classifyTerminalMessage('> look');
  assert.equal(msg.kind, 'command');
  assert.equal(msg.text, '> look');
});

test('classifies system lines', () => {
  const msg = classifyTerminalMessage(`${SYS_PREFIX}Checkpoint reloaded.`);
  assert.equal(msg.kind, 'system');
  assert.equal(msg.text, 'Checkpoint reloaded.');
});

test('classifies fatal lines', () => {
  const msg = classifyTerminalMessage(`${FATAL_PREFIX}YOU HAVE DIED.`);
  assert.equal(msg.kind, 'fatal');
  assert.equal(msg.text, 'YOU HAVE DIED.');
});

test('defaults to narrative lines', () => {
  const msg = classifyTerminalMessage('The hallway creaks.');
  assert.equal(msg.kind, 'narrative');
  assert.equal(msg.text, 'The hallway creaks.');
});
