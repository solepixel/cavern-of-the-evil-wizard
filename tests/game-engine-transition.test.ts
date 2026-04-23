import assert from 'node:assert/strict';
import test from 'node:test';
import './testEnv';
import { INITIAL_STATE } from '../src/gameData';
import { transitionCommand } from '../src/lib/gameEngine';

test('transitionCommand emits scene and history effects for intro command', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'cutscene_intro',
  };

  const result = transitionCommand(start, 'explore the room');
  const effectTypes = result.effects.map((e) => e.type);

  assert.equal(result.state.currentSceneId, 'bedroom');
  assert.ok(effectTypes.includes('history.append'));
  assert.ok(effectTypes.includes('scene.changed'));
});

test('transitionCommand emits inventory effect when player gets an item', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'bedroom',
    history: [],
    inventory: [],
  };

  const result = transitionCommand(start, 'open wardrobe');
  const inventoryEffect = result.effects.find((e) => e.type === 'inventory.changed');
  assert.ok(inventoryEffect);
  if (inventoryEffect?.type === 'inventory.changed') {
    assert.ok(inventoryEffect.added.includes('old_key'));
  }
});
