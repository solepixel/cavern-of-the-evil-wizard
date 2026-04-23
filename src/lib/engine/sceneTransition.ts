import { GameState, Item, Scene } from '../../types';

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
      return { state, soundsToPlay: [], shouldCheckpoint: false };
    }
    return {
      state: { ...state, history: [...state.history, replaceName(preamble, state.playerName)] },
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

  let next: GameState = { ...state, flags: { ...state.flags } };
  if (fromSceneId !== undefined && fromSceneId !== sceneId) {
    next = { ...next, focusedObjectId: undefined };
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
      if (scene.onLoad.getItem === 'map') {
        next.hasMap = true;
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
    implicitScore += deps.scoreFirstEnterScene;
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
