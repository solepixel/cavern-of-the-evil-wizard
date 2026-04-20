import { GameState } from '../types';
import { SCENES, OBJECTS, ITEMS } from '../gameData';
import { resolveObjectInteraction } from './gameEngine';
import { formatObjectStateForDisplay, serializeObjectAxes } from './objectState';

export type DebugObjectInteractions = {
  objectId: string;
  name: string;
  state: string;
  lines: string[];
};

export function buildGameplayDebugSnapshot(state: GameState): {
  sceneId: string;
  sceneTitle: string;
  sceneExists: boolean;
  sceneExits: string;
  sceneCommandPatterns: string[];
  interactionLabels: string[];
  character: string[];
  inventoryLines: string[];
  flagsLines: string[];
  objectStatesLines: string[];
  objects: DebugObjectInteractions[];
  meta: string[];
} {
  const scene = SCENES[state.currentSceneId];
  const sceneExists = Boolean(scene);

  const character = [
    `playerName: ${state.playerName || '(empty)'}`,
    `hp: ${state.hp} / ${state.maxHp}`,
    `score: ${state.score ?? 0}`,
    `deadline: ${state.deadlineSceneId ? `${state.deadlineSceneId} @${state.deadlineAtMs ?? '?'} turns=${state.deadlineTurnsLeft ?? '—'} (${state.deadlineReason ?? '—'})` : '(none)'}`,
    `pendingPrompt: ${state.pendingPrompt ? `${state.pendingPrompt.id} (${Object.keys(state.pendingPrompt.aliases).length} aliases)` : '(none)'}`,
    `equippedItemIds: ${(state.equippedItemIds ?? []).length ? state.equippedItemIds!.join(', ') : '(none)'}`,
    `focusedObjectId: ${state.focusedObjectId ?? '(none)'}`,
    `uiVisible: ${state.uiVisible}`,
    `hasMap: ${state.hasMap}`,
    `gameStarted: ${state.gameStarted}`,
    `namingPhase: ${state.namingPhase}`,
    `isGameOver: ${state.isGameOver}`,
    `pendingItem: ${state.pendingItem ?? '(none)'}`,
  ];

  const inventoryLines =
    state.inventory.length === 0
      ? ['(empty)']
      : state.inventory.map((id) => {
          const it = ITEMS[id];
          return it ? `${id} — ${it.name}` : id;
        });

  const flagsLines =
    Object.keys(state.flags).length === 0
      ? ['(none)']
      : Object.entries(state.flags).map(([k, v]) => `${k}: ${String(v)}`);

  const objectStatesLines =
    Object.keys(state.objectStates).length === 0
      ? ['(none)']
      : Object.entries(state.objectStates).map(([oid, raw]) => {
          const obj = OBJECTS[oid];
          if (!obj) return `${oid}: ${String(raw)}`;
          if (typeof raw === 'string') return `${oid}: ${raw}`;
          return `${oid}: ${serializeObjectAxes(raw as Record<string, string>)}`;
        });

  const sceneExits = scene
    ? Object.entries(scene.exits)
        .map(([dir, tid]) => `${dir} → ${tid}`)
        .join(' | ') || '(none)'
    : '—';

  const sceneCommandPatterns = scene?.commands ? Object.keys(scene.commands) : [];

  const interactionLabels = scene?.interactionLabels ?? [];

  const objects: DebugObjectInteractions[] = [];
  if (scene) {
    for (const oid of scene.objects) {
      const obj = OBJECTS[oid];
      if (!obj) {
        objects.push({ objectId: oid, name: '?', state: '', lines: ['(missing from OBJECTS)'] });
        continue;
      }
      const st = formatObjectStateForDisplay(state, oid, obj);
      const lines: string[] = [];
      for (const raw of obj.interactions) {
        let note = '';
        if (raw.reuseInteractionId) note += `reuseInteractionId: ${raw.reuseInteractionId} `;
        if (raw.id) note += `id: ${raw.id}`;
        const resolved = resolveObjectInteraction(raw, obj);
        const tail = [
          resolved.examineReuse ? '→ examine behavior' : '',
          resolved.text ? `text: ${resolved.text.slice(0, 60)}${resolved.text.length > 60 ? '…' : ''}` : '',
          resolved.getItem ? `getItem: ${resolved.getItem}` : '',
          resolved.setState ? `setState: ${resolved.setState}` : '',
          resolved.setAxes ? `setAxes: ${JSON.stringify(resolved.setAxes)}` : '',
          resolved.whenAxes ? `whenAxes: ${JSON.stringify(resolved.whenAxes)}` : '',
          resolved.nextScene ? `nextScene: ${resolved.nextScene}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        lines.push(`/${resolved.regex}/ ${note ? `(${note.trim()}) ` : ''}${tail ? `— ${tail}` : ''}`);
      }
      objects.push({
        objectId: oid,
        name: obj.name,
        state: st,
        lines,
      });
    }
  }

  const meta = [
    `history lines: ${state.history.length}`,
    `lastCheckpoint: ${state.lastCheckpoint ? `scene ${state.lastCheckpoint.currentSceneId}` : '(none)'}`,
  ];

  return {
    sceneId: state.currentSceneId,
    sceneTitle: scene?.title.replace(/\{\{name\}\}/g, state.playerName) ?? '(unknown scene)',
    sceneExists,
    sceneExits,
    sceneCommandPatterns,
    interactionLabels,
    character,
    inventoryLines,
    flagsLines,
    objectStatesLines,
    objects,
    meta,
  };
}
