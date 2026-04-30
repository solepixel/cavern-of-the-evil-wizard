import { GameState, Item, Scene } from '../../types';
import { resolveFirstEnterSceneScore } from '../gameScoring';

export interface SceneTransitionDeps {
  scenes: Record<string, Scene>;
  items: Record<string, Item>;
  scorePickupItem: number;
  scoreFirstEnterScene: number;
  runSceneEnterHook?: (state: GameState, sceneId: string, fromSceneId?: string) => GameState;
}

export interface SceneTransitionOptions {
  state: GameState;
  sceneId: string;
  preamble?: string;
  fromSceneId?: string;
  implicitCarry?: number;
  includeSceneHooks?: boolean;
}

export interface SceneTransitionResult {
  state: GameState;
  soundsToPlay: string[];
  shouldCheckpoint: boolean;
}

function replaceName(text: string, playerName: string): string {
  return text.replace(/{{name}}/g, playerName);
}

function itemAnimationTarget(items: Record<string, Item>, itemId: string): 'inventory' | 'equipment' {
  const it = items[itemId];
  const t = it?.itemType ?? (it?.equippable ? 'gear' : 'misc');
  return t === 'gear' || t === 'weapon' ? 'equipment' : 'inventory';
}

function isMapItemId(itemId: string): boolean {
  return itemId === 'map' || itemId === 'world_map';
}

function visitedRegionFlagForScene(sceneId: string): string | null {
  if (
    sceneId === 'ice_dwarf_village' ||
    sceneId === 'icy_pass' ||
    sceneId === 'glacial_armory' ||
    sceneId === 'ice_cavern_gate' ||
    sceneId === 'ice_wizard_arena' ||
    sceneId === 'relic_escape' ||
    sceneId === 'bandit_pass' ||
    sceneId === 'ice_dwarf_village_final'
  ) {
    return 'visited_ice_region';
  }
  if (sceneId === 'crossroads' || sceneId === 'crossroads_map_overlook') return 'visited_crossroads';
  if (sceneId.startsWith('water_')) return 'visited_water_region';
  if (sceneId.startsWith('fire_')) return 'visited_fire_region';
  if (sceneId.startsWith('summit_') || sceneId === 'final_wizard_arena') return 'visited_summit_region';
  if (sceneId === 'fairgrounds' || sceneId === 'cutscene_bike_to_fairgrounds') return 'visited_fair_region';
  if (
    sceneId === 'bedroom' ||
    sceneId === 'hallway' ||
    sceneId === 'bathroom_hall' ||
    sceneId === 'parents_bedroom' ||
    sceneId === 'cutscene_house_escape'
  ) {
    return 'visited_house_region';
  }
  return null;
}

export function transitionIntoScene(deps: SceneTransitionDeps, options: SceneTransitionOptions): SceneTransitionResult {
  const {
    state,
    sceneId,
    preamble,
    fromSceneId,
    implicitCarry = 0,
    includeSceneHooks = true,
  } = options;
  const scene = deps.scenes[sceneId];
  if (!scene) {
    if (!preamble) {
      return { state: { ...state, currentSceneId: sceneId }, soundsToPlay: [], shouldCheckpoint: false };
    }
    return {
      state: {
        ...state,
        currentSceneId: sceneId,
        history: [...state.history, replaceName(preamble, state.playerName)],
      },
      soundsToPlay: [],
      shouldCheckpoint: false,
    };
  }

  const onLoadFlag = `__sceneOnLoad__:${sceneId}`;
  const firstOnLoad = Boolean(scene.onLoad && !state.flags[onLoadFlag]);
  const soundsToPlay: string[] = [];
  const parts: string[] = [];
  if (preamble) {
    parts.push(replaceName(preamble, state.playerName));
  }

  let next: GameState = { ...state, currentSceneId: sceneId, flags: { ...state.flags } };
  if (fromSceneId !== undefined && fromSceneId !== sceneId) {
    next = { ...next, focusedObjectId: undefined };
  }
  const visitedFlag = visitedRegionFlagForScene(sceneId);
  if (visitedFlag) {
    next.flags[visitedFlag] = true;
  }

  let implicitScore = implicitCarry;

  if (firstOnLoad && scene.onLoad) {
    next.flags[onLoadFlag] = true;
    if (scene.onLoad.text) {
      parts.push(replaceName(scene.onLoad.text, state.playerName));
    }
    if (scene.onLoad.sound) {
      const sounds = Array.isArray(scene.onLoad.sound) ? scene.onLoad.sound : [scene.onLoad.sound];
      soundsToPlay.push(...sounds);
    }
    if (scene.onLoad.getItem && !next.inventory.includes(scene.onLoad.getItem)) {
      next.inventory = [...next.inventory, scene.onLoad.getItem];
      next.uiVisible = true;
      next.pendingItem = scene.onLoad.getItem;
      next.pendingItemQueue = [
        ...(next.pendingItemQueue ?? []),
        { id: scene.onLoad.getItem, target: itemAnimationTarget(deps.items, scene.onLoad.getItem) },
      ];
      if (isMapItemId(scene.onLoad.getItem)) {
        next.hasMap = true;
        next.flags.map_unlocked = true;
      }
      implicitScore += deps.scorePickupItem;
    }
    if (scene.onLoad.removeItem && next.inventory.includes(scene.onLoad.removeItem)) {
      next.inventory = next.inventory.filter((id) => id !== scene.onLoad!.removeItem);
    }
    if (scene.onLoad.setFlags) {
      next.flags = { ...next.flags, ...scene.onLoad.setFlags };
    }
  } else if (scene.description) {
    parts.push(replaceName(scene.description, state.playerName));
  }

  if (parts.length > 0) {
    next.history = [...next.history, parts.join('\n\n')];
  }

  if (includeSceneHooks && deps.runSceneEnterHook) {
    next = deps.runSceneEnterHook(next, sceneId, fromSceneId);
  }

  const progressFlag = `__sceneProgressScore__:${sceneId}`;
  if (fromSceneId && fromSceneId !== sceneId && !next.flags[progressFlag]) {
    next.flags = { ...next.flags, [progressFlag]: true };
    const firstEnterScore = resolveFirstEnterSceneScore(scene.firstEnterScore ?? deps.scoreFirstEnterScene);
    implicitScore += firstEnterScore;
  }
  if (implicitScore > 0) {
    next.score = (next.score ?? 0) + implicitScore;
  }

  return {
    state: next,
    soundsToPlay,
    shouldCheckpoint: Boolean(scene.isCheckpoint && !next.isGameOver),
  };
}
