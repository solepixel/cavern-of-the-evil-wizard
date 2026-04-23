import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_STATE, ITEMS, OBJECTS, SCENES } from '../src/gameData';
import { validateContentRegistry } from '../src/lib/contentSchema';

test('content registry validates baseline game data', () => {
  const result = validateContentRegistry({
    items: ITEMS,
    objects: OBJECTS,
    scenes: SCENES,
    initialState: INITIAL_STATE,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test('content registry catches missing nextScene references', () => {
  const result = validateContentRegistry({
    items: ITEMS,
    objects: OBJECTS,
    scenes: {
      ...SCENES,
      broken_scene: {
        ...SCENES.bedroom,
        id: 'broken_scene',
        commands: {
          'go void': {
            nextScene: 'missing_scene',
          },
        },
        objects: [],
        exits: {},
      },
    },
    initialState: { ...INITIAL_STATE, currentSceneId: 'broken_scene' },
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.message.includes('missing_scene')));
});
