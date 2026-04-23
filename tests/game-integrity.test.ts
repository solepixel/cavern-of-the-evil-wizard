import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_STATE, OBJECTS, SCENES } from '../src/gameData';

function collectStaticSceneEdges(sceneId: string): string[] {
  const scene = SCENES[sceneId];
  if (!scene) return [];
  const next = new Set<string>();

  Object.values(scene.exits ?? {}).forEach((target) => {
    if (typeof target === 'string' && target.trim()) next.add(target);
  });

  Object.values(scene.commands ?? {}).forEach((response) => {
    if (response?.nextScene) next.add(response.nextScene);
  });

  for (const objId of scene.objects ?? []) {
    const obj = OBJECTS[objId];
    if (!obj) continue;
    for (const interaction of obj.interactions ?? []) {
      if (interaction?.nextScene) next.add(interaction.nextScene);
    }
  }

  return [...next];
}

test('cutscene panel ordinals are contiguous with no gaps', () => {
  const cutscenes = Object.values(SCENES)
    .filter((s) => s.id.startsWith('cutscene_'))
    .map((s) => ({ id: s.id, ordinal: s.cutscenePanelOrdinal }))
    .sort((a, b) => (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER));

  assert.ok(cutscenes.length > 0, 'Expected at least one cutscene scene.');
  for (const c of cutscenes) {
    assert.equal(typeof c.ordinal, 'number', `Missing cutscenePanelOrdinal for ${c.id}`);
  }

  const ordinals = cutscenes.map((c) => c.ordinal as number);
  assert.equal(ordinals[0], 1, 'Cutscene ordinals should start at 1.');
  for (let i = 1; i < ordinals.length; i += 1) {
    assert.equal(
      ordinals[i],
      ordinals[i - 1] + 1,
      `Cutscene ordinals must be contiguous; found ${ordinals[i - 1]} then ${ordinals[i]}.`,
    );
  }
});

test('all static scene references point to valid scenes', () => {
  const missing: string[] = [];
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    for (const [exitName, target] of Object.entries(scene.exits ?? {})) {
      if (!SCENES[target]) missing.push(`${sceneId}.exits.${exitName} -> ${target}`);
    }
    for (const [cmd, response] of Object.entries(scene.commands ?? {})) {
      if (response?.nextScene && !SCENES[response.nextScene]) {
        missing.push(`${sceneId}.commands[${cmd}] -> ${response.nextScene}`);
      }
    }
    for (const objId of scene.objects ?? []) {
      const obj = OBJECTS[objId];
      if (!obj) continue;
      for (const interaction of obj.interactions ?? []) {
        if (interaction?.nextScene && !SCENES[interaction.nextScene]) {
          missing.push(`${sceneId}.objects.${objId}.interaction(${interaction.regex}) -> ${interaction.nextScene}`);
        }
      }
    }
  }

  assert.deepEqual(missing, [], `Found scene references to missing ids:\n${missing.join('\n')}`);
});

test('non-cutscene scenes expose at least one apparent path forward', () => {
  const likelyDeadEnds: string[] = [];
  for (const scene of Object.values(SCENES)) {
    if (scene.id.startsWith('cutscene_')) continue;
    if (scene.id.startsWith('ending_')) continue; // Terminal ending rooms are intentionally final.
    const hasExit = Object.keys(scene.exits ?? {}).length > 0;
    const hasStaticSceneJump = collectStaticSceneEdges(scene.id).length > 0;
    const hasCallbackPath = Object.values(scene.commands ?? {}).some((c) => typeof c?.callback === 'function');
    const hasObjectCallbackPath = (scene.objects ?? []).some((objId) =>
      (OBJECTS[objId]?.interactions ?? []).some((i) => typeof i?.callback === 'function'),
    );
    if (!hasExit && !hasStaticSceneJump && !hasCallbackPath && !hasObjectCallbackPath) {
      likelyDeadEnds.push(scene.id);
    }
  }

  assert.deepEqual(
    likelyDeadEnds,
    [],
    `Likely dead-end scenes detected (no exits, nextScene edges, or callbacks): ${likelyDeadEnds.join(', ')}`,
  );
});

test('initial scene can reach the broader graph through static links', () => {
  const visited = new Set<string>();
  const queue = [INITIAL_STATE.currentSceneId];

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of collectStaticSceneEdges(cur)) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  assert.ok(
    visited.size >= 4,
    `Expected to reach several scenes from initial state via static links, reached only ${visited.size}.`,
  );
});
