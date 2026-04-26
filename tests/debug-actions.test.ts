import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_STATE } from '../src/gameData';
import {
  addInventoryItems,
  deleteFlag,
  equipItem,
  jumpToScene,
  setFlagValue,
  setObjectAxis,
  setPlayerStateField,
  unequipItem,
} from '../src/lib/debugActions';

test('jumpToScene moves to valid scene and keeps game active', () => {
  const start = { ...INITIAL_STATE, gameStarted: true, namingPhase: false, currentSceneId: 'bedroom', history: [] };
  const next = jumpToScene(start, 'hallway');
  assert.equal(next.currentSceneId, 'hallway');
  assert.equal(next.gameStarted, true);
  assert.equal(next.isGameOver, false);
  assert.ok(next.history[next.history.length - 1]?.includes('DEBUG: jumped to scene'));
});

test('inventory add + equip + unequip flow works', () => {
  const start = { ...INITIAL_STATE, inventory: [], equippedItemIds: [] };
  const withItem = addInventoryItems(start, ['giants_hoodie']);
  assert.ok(withItem.inventory.includes('giants_hoodie'));
  const equipped = equipItem(withItem, 'giants_hoodie');
  assert.ok(equipped.equippedItemIds.includes('giants_hoodie'));
  const unequipped = unequipItem(equipped, 'giants_hoodie');
  assert.ok(!unequipped.equippedItemIds.includes('giants_hoodie'));
});

test('flags and object axes mutate as expected', () => {
  const start = { ...INITIAL_STATE, flags: {}, objectStates: {} };
  const withFlag = setFlagValue(start, 'test_flag', true);
  assert.equal(withFlag.flags.test_flag, true);
  const withoutFlag = deleteFlag(withFlag, 'test_flag');
  assert.ok(!('test_flag' in withoutFlag.flags));

  const withAxis = setObjectAxis(start, 'wardrobe', 'door', 'open');
  const wardrobe = withAxis.objectStates.wardrobe;
  assert.equal(typeof wardrobe, 'object');
  if (typeof wardrobe === 'object' && wardrobe) {
    assert.equal((wardrobe as Record<string, string>).door, 'open');
  }
});

test('player state field setter clamps numeric ranges', () => {
  const start = { ...INITIAL_STATE, hp: 100, maxHp: 100, score: 0 };
  const next = setPlayerStateField(start, { hp: 999, maxHp: 10, score: -5 });
  assert.equal(next.maxHp, 10);
  assert.equal(next.hp, 10);
  assert.equal(next.score, 0);
});

