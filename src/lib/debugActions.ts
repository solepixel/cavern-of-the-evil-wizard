import { ITEMS, SCENES } from '../gameData';
import { GameState, ItemId } from '../types';
import { processCommand } from './gameEngine';

export function jumpToScene(state: GameState, sceneId: string): GameState {
  if (!SCENES[sceneId]) return state;
  return {
    ...state,
    currentSceneId: sceneId,
    isGameOver: false,
    gameStarted: true,
    namingPhase: false,
    history: [...state.history, `[SYS] DEBUG: jumped to scene "${sceneId}".`],
  };
}

export function addInventoryItems(state: GameState, itemIds: ItemId[]): GameState {
  const current = new Set(state.inventory);
  for (const id of itemIds) {
    if (ITEMS[id]) current.add(id);
  }
  return { ...state, inventory: Array.from(current) };
}

export function removeInventoryItems(state: GameState, itemIds: ItemId[]): GameState {
  const removed = new Set(itemIds);
  const inventory = state.inventory.filter((id) => !removed.has(id));
  const equipped = (state.equippedItemIds ?? []).filter((id) => !removed.has(id));
  return { ...state, inventory, equippedItemIds: equipped };
}

export function equipItem(state: GameState, itemId: ItemId): GameState {
  if (!state.inventory.includes(itemId)) return state;
  const item = ITEMS[itemId];
  if (!item) return state;
  const isEquippable = item.itemType === 'gear' || item.itemType === 'weapon' || item.equippable;
  if (!isEquippable) return state;

  const equipped = [...(state.equippedItemIds ?? [])];
  if (equipped.includes(itemId)) return state;

  if (item.itemType === 'gear' || item.equippable) {
    const targetSlot = item.gearSlot ?? item.equipmentSlot;
    if (targetSlot) {
      const filtered = equipped.filter((id) => {
        const existing = ITEMS[id];
        if (!existing) return true;
        return (existing.gearSlot ?? existing.equipmentSlot) !== targetSlot;
      });
      return { ...state, equippedItemIds: [...filtered, itemId] };
    }
  }

  if (item.itemType === 'weapon') {
    const hand = item.weaponHand ?? 'right';
    const filtered = equipped.filter((id) => {
      const existing = ITEMS[id];
      if (!existing || existing.itemType !== 'weapon') return true;
      return (existing.weaponHand ?? 'right') !== hand;
    });
    return { ...state, equippedItemIds: [...filtered, itemId] };
  }

  return { ...state, equippedItemIds: [...equipped, itemId] };
}

export function unequipItem(state: GameState, itemId: ItemId): GameState {
  return {
    ...state,
    equippedItemIds: (state.equippedItemIds ?? []).filter((id) => id !== itemId),
  };
}

export function setPlayerStateField(
  state: GameState,
  patch: Partial<
    Pick<
      GameState,
      'playerName' | 'hp' | 'maxHp' | 'score' | 'uiVisible' | 'gameStarted' | 'namingPhase' | 'hasMap' | 'isGameOver'
    >
  >,
): GameState {
  const next: GameState = { ...state, ...patch };
  if (next.maxHp < 1) next.maxHp = 1;
  if (next.hp < 0) next.hp = 0;
  if (next.hp > next.maxHp) next.hp = next.maxHp;
  if (next.score < 0) next.score = 0;
  return next;
}

export function setFlagValue(state: GameState, key: string, value: boolean | number | string): GameState {
  if (!key.trim()) return state;
  return {
    ...state,
    flags: { ...state.flags, [key.trim()]: value },
  };
}

export function deleteFlag(state: GameState, key: string): GameState {
  if (!(key in state.flags)) return state;
  const flags = { ...state.flags };
  delete flags[key];
  return { ...state, flags };
}

export function setObjectStateValue(state: GameState, objectId: string, value: string | Record<string, string>): GameState {
  if (!objectId.trim()) return state;
  return {
    ...state,
    objectStates: {
      ...state.objectStates,
      [objectId]: value,
    },
  };
}

export function setObjectAxis(state: GameState, objectId: string, axis: string, axisValue: string): GameState {
  if (!objectId.trim() || !axis.trim()) return state;
  const current = state.objectStates[objectId];
  if (typeof current === 'string') {
    return {
      ...state,
      objectStates: {
        ...state.objectStates,
        [objectId]: { s: current, [axis]: axisValue },
      },
    };
  }
  const axes = { ...(current ?? {}), [axis]: axisValue } as Record<string, string>;
  return setObjectStateValue(state, objectId, axes);
}

export function runDebugCommand(state: GameState, command: string): GameState {
  if (!command.trim()) return state;
  return processCommand(state, command);
}

