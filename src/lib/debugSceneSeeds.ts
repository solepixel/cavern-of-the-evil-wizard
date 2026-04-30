import { ITEMS, INITIAL_STATE, SCENES } from '../gameData';
import { GameState, ItemId } from '../types';
import { processCommand } from './gameEngine';

/** Progression fields applied when jumping to a scene from the debug panel (except opening scenes). */
export type DebugSceneProgressionPatch = Pick<
  GameState,
  'inventory' | 'equippedItemIds' | 'flags' | 'objectStates' | 'hasMap' | 'score' | 'achievementLevels' | 'uiVisible'
>;

const OPENING_NO_SEED_SCENES = new Set(['cutscene_intro', 'bedroom']);

function ensureHeadlessSessionShims(): void {
  const g = globalThis as unknown as {
    localStorage?: Storage;
    Audio?: unknown;
  };

  if (!g.localStorage) {
    const store = new Map<string, string>();
    g.localStorage = {
      getItem(key: string) {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
      key() {
        return null;
      },
      get length() {
        return store.size;
      },
    };
  }

  if (typeof g.Audio !== 'undefined') return;
  class AudioMock {
    src = '';
    currentTime = 0;
    paused = true;
    volume = 1;
    loop = false;
    preload = 'none';
    oncanplaythrough: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onended: (() => void) | null = null;
    addEventListener() {}
    removeEventListener() {}
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  g.Audio = AudioMock as unknown as typeof Audio;
}

function cloneObjectStates(
  objectStates: GameState['objectStates'],
): Record<string, string | Record<string, string>> {
  const out: Record<string, string | Record<string, string>> = {};
  for (const [id, v] of Object.entries(objectStates ?? {})) {
    out[id] = typeof v === 'string' ? v : { ...v };
  }
  return out;
}

function extractProgressionPatch(state: GameState): DebugSceneProgressionPatch {
  return {
    inventory: [...state.inventory],
    equippedItemIds: [...(state.equippedItemIds ?? [])],
    flags: { ...(state.flags ?? {}) },
    objectStates: cloneObjectStates(state.objectStates ?? {}),
    hasMap: !!state.hasMap,
    score: Number(state.score ?? 0),
    achievementLevels: { ...(state.achievementLevels ?? {}) },
    uiVisible: !!state.uiVisible,
  };
}

function mergeInventoryUnique(inv: ItemId[], add: ItemId[]): ItemId[] {
  const next = [...inv];
  for (const id of add) {
    if (!ITEMS[id]) continue;
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

function patchWithExtras(
  base: DebugSceneProgressionPatch,
  extras: { addInventory?: ItemId[]; flags?: GameState['flags']; score?: number; uiVisible?: boolean },
): DebugSceneProgressionPatch {
  const inventory = mergeInventoryUnique(base.inventory, extras.addInventory ?? []);
  const equipped = base.equippedItemIds.filter((id) => inventory.includes(id));
  return {
    ...base,
    inventory,
    equippedItemIds: equipped,
    flags: { ...base.flags, ...(extras.flags ?? {}) },
    objectStates: cloneObjectStates(base.objectStates),
    hasMap: base.hasMap,
    score: extras.score ?? base.score,
    achievementLevels: { ...base.achievementLevels },
    uiVisible: extras.uiVisible ?? true,
  };
}

function progressionPatchToGameState(patch: DebugSceneProgressionPatch, sceneId: string): GameState {
  const inv = [...patch.inventory];
  const equipped = patch.equippedItemIds.filter((id) => inv.includes(id));
  return {
    ...INITIAL_STATE,
    playerName: INITIAL_STATE.playerName,
    currentSceneId: sceneId,
    inventory: inv,
    equippedItemIds: equipped,
    objectStates: cloneObjectStates(patch.objectStates),
    flags: { ...patch.flags },
    history: [],
    isGameOver: false,
    gameStarted: true,
    namingPhase: false,
    uiVisible: patch.uiVisible,
    hasMap: patch.hasMap,
    score: patch.score,
    achievementLevels: { ...patch.achievementLevels },
    hp: INITIAL_STATE.hp,
    maxHp: INITIAL_STATE.maxHp,
    pendingItem: null,
    pendingItemQueue: [],
    pendingAchievementQueue: [],
    pendingPrompt: undefined,
    deadlineAtMs: undefined,
    deadlineSceneId: undefined,
    deadlineReason: undefined,
    deadlineTurnsLeft: undefined,
    lastCheckpoint: undefined,
    focusedObjectId: undefined,
  };
}

/**
 * Canonical command replay used to derive "you could have reached this scene" baselines for debug jumps.
 * Later snapshots overwrite earlier ones for the same scene id.
 */
const DEBUG_PROGRESSION_COMMANDS: string[] = [
  'open wardrobe',
  'take key',
  'look under rug',
  'use key on door',
  'go south',
  'open closet',
  'take clothing',
  'equip NY Giants Hoodie',
  'equip Gray Sweatpants',
  'equip White Sneakers',
  'take rattle',
  'give rattle to sister',
  'go hallway',
  'go north',
  'TAKE BIKE TO FAIRGROUNDS',
  'EXPLORE FAIRGROUND',
  'use quarter on zoltar',
  'continue',
  'train',
  'take sword',
  'go north',
  'go north',
  'take armor',
  'equip glacial armor',
  'go north',
  'enter cavern',
  'melt wizard',
  'use thermal pod on wizard',
  'run',
  'talk',
  'give relic',
];

let cachedSeeds: Record<string, DebugSceneProgressionPatch> | null = null;

function buildSeedsFromReplay(): Record<string, DebugSceneProgressionPatch> {
  ensureHeadlessSessionShims();

  const byScene: Record<string, DebugSceneProgressionPatch> = {};

  let state: GameState = {
    ...INITIAL_STATE,
    gameStarted: true,
    namingPhase: false,
    history: [],
    pendingItem: null,
    pendingItemQueue: [],
    pendingAchievementQueue: [],
    lastCheckpoint: undefined,
  };

  const record = () => {
    const id = state.currentSceneId;
    if (!SCENES[id]) return;
    byScene[id] = extractProgressionPatch(state);
  };

  record();

  for (const line of DEBUG_PROGRESSION_COMMANDS) {
    state = processCommand(state, line);
    if (state.isGameOver) break;
    record();
  }

  if (byScene.hallway) {
    let branch = progressionPatchToGameState(byScene.hallway, 'hallway');
    branch = processCommand(branch, 'go east');
    if (!branch.isGameOver && SCENES[branch.currentSceneId]) {
      byScene[branch.currentSceneId] = extractProgressionPatch(branch);
    }
  }

  const cross = byScene.crossroads;
  if (cross) {
    byScene.water_village = patchWithExtras(cross, {
      addInventory: ['ice_staff'],
      uiVisible: true,
    });
    byScene.fire_village = patchWithExtras(cross, {
      addInventory: ['water_staff'],
      uiVisible: true,
    });
    const summitInv = mergeInventoryUnique(cross.inventory, [
      'ice_staff',
      'water_staff',
      'fire_staff',
      'special_gloves',
      'scuba_gear',
      'protection_cloak',
    ]);
    const summitEquipped = [...cross.equippedItemIds, 'special_gloves', 'scuba_gear', 'protection_cloak'].filter((id) =>
      summitInv.includes(id),
    );
    byScene.summit_gate = {
      ...cross,
      inventory: summitInv,
      equippedItemIds: Array.from(new Set(summitEquipped)),
      flags: { ...cross.flags },
      objectStates: cloneObjectStates(cross.objectStates),
      hasMap: cross.hasMap,
      score: cross.score,
      achievementLevels: { ...cross.achievementLevels },
      uiVisible: true,
    };
    byScene.ending_fair_return = patchWithExtras(cross, {
      addInventory: ['wizard_staff'],
      score: Math.max(cross.score, 1600),
      uiVisible: true,
    });
  }

  return byScene;
}

export function getDebugSceneProgressionPatch(sceneId: string): DebugSceneProgressionPatch | undefined {
  if (OPENING_NO_SEED_SCENES.has(sceneId)) return undefined;
  if (!cachedSeeds) {
    cachedSeeds = buildSeedsFromReplay();
  }

  if (cachedSeeds[sceneId]) {
    const p = cachedSeeds[sceneId];
    return { ...p, uiVisible: true };
  }

  if (sceneId === 'bathroom_hall' && cachedSeeds.hallway) {
    return { ...cachedSeeds.hallway, uiVisible: true };
  }

  const fallback =
    cachedSeeds.crossroads ??
    cachedSeeds.ice_dwarf_village ??
    cachedSeeds.fairgrounds ??
    cachedSeeds.hallway;
  if (fallback && SCENES[sceneId]) {
    return { ...fallback, uiVisible: true };
  }

  return undefined;
}

export function __resetDebugSceneSeedsCacheForTests(): void {
  cachedSeeds = null;
}
