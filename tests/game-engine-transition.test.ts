import assert from 'node:assert/strict';
import test from 'node:test';
import './testEnv';
import { INITIAL_STATE } from '../src/gameData';
import { transitionCommand } from '../src/lib/gameEngine';

function runCommands(start: typeof INITIAL_STATE, commands: string[]) {
  return commands.reduce((s, cmd) => transitionCommand(s, cmd).state, start);
}

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

test('opening wardrobe no longer auto-picks key; take key emits inventory effect', () => {
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

  const opened = transitionCommand(start, 'open wardrobe');
  const openInventoryEffect = opened.effects.find((e) => e.type === 'inventory.changed');
  assert.equal(openInventoryEffect, undefined);

  const result = transitionCommand(opened.state, 'take key');
  const inventoryEffect = result.effects.find((e) => e.type === 'inventory.changed');
  assert.ok(inventoryEffect);
  if (inventoryEffect?.type === 'inventory.changed') {
    assert.ok(inventoryEffect.added.includes('old_key'));
  }
});

test('examine parents closet command resolves in parents bedroom', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'parents_bedroom',
    history: [],
  };

  const result = transitionCommand(start, 'examine parents closet').state;
  const last = result.history[result.history.length - 1] ?? '';
  assert.notEqual(last, 'Command not recognized.');
});

test('hallway callback transition updates currentSceneId and allows go north/downstairs', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'parents_bedroom',
    history: [],
    inventory: ['giants_hoodie', 'sweatpants_gray', 'sneakers_white'],
    equippedItemIds: ['giants_hoodie', 'sweatpants_gray', 'sneakers_white'],
    flags: { house_arc_need_hurry: true },
    objectStates: { playpen: { sister: 'quiet' } },
  };

  const dressed = transitionCommand(start, 'go hallway').state;

  assert.equal(dressed.currentSceneId, 'hallway');

  const north = transitionCommand(dressed, 'go north').state;
  assert.notEqual(north.history[north.history.length - 1], 'Command not recognized.');

  const downstairs = transitionCommand(dressed, 'go downstairs').state;
  assert.notEqual(downstairs.history[downstairs.history.length - 1], 'Command not recognized.');
});

test('jumping on bed inflicts 50 damage and requires two failures for death', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'bedroom',
    history: [],
    hp: 100,
    maxHp: 100,
  };

  const first = transitionCommand(start, 'jump on bed').state;
  assert.equal(first.hp, 50);
  assert.equal(first.isGameOver, false);

  const second = transitionCommand(first, 'jump on bed').state;
  assert.equal(second.hp, 0);
  assert.equal(second.isGameOver, true);
});

test('look under bed awards score only once', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'bedroom',
    history: [],
    score: 0,
  };

  const first = transitionCommand(start, 'look under bed').state;
  assert.equal(first.score, 5);

  const second = transitionCommand(first, 'look under bed').state;
  assert.equal(second.score, 5);
});

test('looking under rug after fixing flips rug back again', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'bedroom',
    history: [],
    inventory: [],
    objectStates: {},
  };

  const firstLook = transitionCommand(start, 'look under rug').state;
  assert.deepEqual(firstLook.objectStates.rug, { lay: 'flipped', contents: 'empty' });

  const fixed = transitionCommand(firstLook, 'fix rug').state;
  assert.deepEqual(fixed.objectStates.rug, { lay: 'flat', contents: 'empty' });

  const secondLook = transitionCommand(fixed, 'look under rug').state;
  assert.deepEqual(secondLook.objectStates.rug, { lay: 'flipped', contents: 'empty' });
});

test('full bedroom-to-return-house branch remains stable and ends in death state', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'cutscene_intro',
    history: [],
  };

  const script: Array<{ cmd: string; expect: string }> = [
    { cmd: 'explore the room', expect: 'You wake up in a room that feels impossibly small.' },
    { cmd: 'look out window', expect: 'You look out the window.' },
    { cmd: 'open wardrobe', expect: 'You open the wardrobe.' },
    { cmd: 'take key', expect: 'You take the OLD BRASS KEY' },
    { cmd: 'close wardrobe', expect: 'You close the wardrobe.' },
    { cmd: 'look under rug', expect: 'you find a QUARTER' },
    { cmd: 'make bed', expect: "It's now made. Well done!" },
    { cmd: 'look under bed', expect: 'no monsters under there' },
    { cmd: 'fix rug', expect: "It's now flat." },
    { cmd: 'use key on door', expect: "You're in the upstairs hall of your parents' house" },
    { cmd: 'go south', expect: 'The room is dim. Your baby sister is in a PLAYPEN' },
    { cmd: 'examine nightstand', expect: 'A nightstand with a baby RATTLE on top' },
    { cmd: 'take rattle', expect: 'It also feels like peace insurance.' },
    { cmd: 'examine playpen', expect: 'Your baby sister is in the playpen' },
    { cmd: 'give rattle to sister', expect: 'goes suspiciously quiet' },
    { cmd: 'open closet', expect: 'You ease the closet open.' },
    { cmd: 'take clothes', expect: "It's not your style, but at least it fits!" },
    { cmd: 'close closet', expect: 'You close the closet.' },
    { cmd: 'equip Gray Sweatpants', expect: 'You step into the gray sweatpants.' },
    { cmd: 'equip NY Giants Hoodie', expect: 'You pull on the [[Giants hoodie]].' },
    { cmd: 'equip White Sneakers', expect: 'You lace up the plain [[white dad-sneakers]].' },
    { cmd: 'go hallway', expect: "You'd better move." },
    { cmd: 'go downstairs', expect: 'The suburban night air hits you like a reboot.' },
    { cmd: 'RETURN TO HOUSE', expect: 'everything goes sideways—fast.' },
  ];

  let state = start;
  for (const step of script) {
    const beforeLen = state.history.length;
    state = transitionCommand(state, step.cmd).state;
    const appended = state.history.slice(beforeLen);
    assert.ok(!appended.includes('Command not recognized.'), `Unexpected command failure for: ${step.cmd}`);
    assert.ok(
      appended.some((line) => line.includes(step.expect)),
      `Expected "${step.expect}" after "${step.cmd}" but got:\n${appended.join('\n---\n')}`,
    );
  }

  assert.equal(state.currentSceneId, 'cutscene_house_escape');
  assert.equal(state.isGameOver, true);
  const last = state.history[state.history.length - 1] ?? '';
  assert.ok(last.includes('YOU HAVE DIED.'));
});

test('cutscene option text can be replayed in destination gameplay scene', () => {
  const inFairgrounds = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'fairgrounds',
    history: [],
  };

  const replay = transitionCommand(inFairgrounds, 'explore fairground').state;
  const appended = replay.history[replay.history.length - 1] ?? '';
  assert.ok(appended.includes('At the center of the desolation, one machine remains:'));
});

test('cutscene options that route to another cutscene remain unrecognized outside source', () => {
  const inFairgrounds = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'fairgrounds',
    history: [],
  };

  const result = transitionCommand(inFairgrounds, 'pedal back home').state;
  const appended = result.history[result.history.length - 1] ?? '';
  assert.equal(appended, 'Command not recognized.');
});

test('ice chief grants map after training and sword handoff', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'ice_dwarf_village',
    history: [],
    inventory: [],
    flags: {},
  };

  const tooSoon = transitionCommand(start, 'take sword').state;
  assert.equal(tooSoon.inventory.includes('map'), false);

  const trained = transitionCommand(tooSoon, 'train').state;
  const armed = transitionCommand(trained, 'take sword').state;
  assert.equal(armed.inventory.includes('training_sword'), true);
  assert.equal(armed.inventory.includes('map'), true);
  assert.equal(armed.hasMap, true);
  assert.equal(Boolean(armed.flags.map_unlocked), true);
});

test('map command reports location and fog-of-war state', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'ice_dwarf_village',
    history: [],
    hasMap: true,
    flags: { visited_ice_region: true, visited_crossroads: true },
  };

  const mapped = transitionCommand(start, 'map').state;
  const out = mapped.history[mapped.history.length - 1] ?? '';
  assert.ok(out.includes('WORLD MAP (ZOLTAR EDITION)'));
  assert.ok(out.includes('CURRENT REGION: ICE REGION'));
  assert.ok(out.includes('NORTH   - ICE DWARF VILLAGE: [YOU ARE HERE]'));
  assert.ok(out.includes('WEST    - WATER DWARF VILLAGE: ???'));
});

test('crossroads west path requires ice staff or dies', () => {
  const start = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    uiVisible: true,
    playerName: 'Josh',
    currentSceneId: 'crossroads',
    history: [],
    inventory: [],
  };

  const dead = transitionCommand(start, 'go west').state;
  assert.equal(dead.isGameOver, true);
  assert.equal(dead.hp, 0);

  const staffStart = { ...start, inventory: ['ice_staff'] };
  const survived = transitionCommand(staffStart, 'go west').state;
  assert.equal(survived.isGameOver, false);
  assert.equal(survived.currentSceneId, 'water_village');
});
