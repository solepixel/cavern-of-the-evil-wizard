import {
  GameState,
  CommandResponse,
  GameObject,
  Interaction,
  ItemId,
  REUSE_INTERACTION_EXAMINE,
} from '../types';
import { SCENES, ITEMS, OBJECTS, INITIAL_STATE } from '../gameData';
import { audioService, saveAudioPreferences } from './audioService';
import {
  DEFAULT_LEGACY_STATE_KEY,
  getObjectAxes,
  interactionWhenMatches,
  resolveObjectDescription,
} from './objectState';

const SAVE_KEY = 'cavern_evil_wizard_save';
const SAVE_SLOTS_KEY = 'cavern_evil_wizard_save_slots_v1';

export interface SaveSlotSummary {
  id: string;
  savedAt: number; // epoch ms
  sceneId: string;
  playerName: string;
  /** User-editable label shown in the load dialog (optional). */
  note?: string;
}

interface SaveSlotRecord extends SaveSlotSummary {
  state: GameState;
}

/** Prefix for terminal lines that should render as dim “system” messages in the UI */
export const SYS_PREFIX = '[SYS] ';

/** Prefix for fatal / game-over narrative lines (UI renders in red). */
export const FATAL_PREFIX = '[DEATH] ';

export function sysLine(message: string): string {
  return `${SYS_PREFIX}${message}`;
}

export function fatalLine(message: string): string {
  return `${FATAL_PREFIX}${message}`;
}

export function saveGame(state: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function listSaveSlots(): SaveSlotSummary[] {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SaveSlotRecord[];
    return (parsed ?? [])
      .map(({ id, savedAt, sceneId, playerName, note }) => ({
        id,
        savedAt,
        sceneId,
        playerName,
        ...(typeof note === 'string' && note.trim() !== '' ? { note: note.trim() } : {}),
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function loadSaveSlot(id: string): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSlotRecord[];
    const rec = (parsed ?? []).find((r) => r.id === id);
    if (!rec) return null;
    if (!rec.state.objectStates) rec.state.objectStates = {};
    if (!rec.state.equippedItemIds) rec.state.equippedItemIds = [];
    migrateLegacyWardrobeState(rec.state);
    migrateLegacyRugState(rec.state);
    return rec.state;
  } catch {
    return null;
  }
}

export function deleteSaveSlot(id: string): boolean {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSlotRecord[];
    const next = (parsed ?? []).filter((r) => r.id !== id);
    if (next.length === (parsed ?? []).length) return false;
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Set or clear the checkpoint label shown in the load dialog (`note` empty string removes). */
export function updateSaveSlotNote(id: string, note: string): boolean {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSlotRecord[];
    const idx = (parsed ?? []).findIndex((r) => r.id === id);
    if (idx < 0) return false;
    const trimmed = note.trim();
    const rec = { ...parsed[idx] };
    if (trimmed) rec.note = trimmed;
    else delete rec.note;
    const next = [...parsed];
    next[idx] = rec;
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function persistSaveSlot(state: GameState) {
  const now = Date.now();
  const id = `save_${now}_${Math.random().toString(16).slice(2)}`;
  const record: SaveSlotRecord = {
    id,
    savedAt: now,
    sceneId: state.currentSceneId,
    playerName: state.playerName,
    state,
  };
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SaveSlotRecord[]) : [];
    const next = [record, ...(parsed ?? [])].slice(0, 30);
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Expands `reuseInteractionId` by merging with the referenced interaction in the same object.
 * Authoring fields `id` and `reuseInteractionId` are stripped from the result.
 */
export function resolveObjectInteraction(
  raw: Interaction,
  obj: GameObject,
  visitingIds: Set<string> = new Set(),
): Interaction {
  const targetId = raw.reuseInteractionId;
  if (!targetId) {
    const { id: _i, reuseInteractionId: _r, ...rest } = raw;
    return rest as Interaction;
  }

  if (targetId === REUSE_INTERACTION_EXAMINE) {
    const { id: _i, reuseInteractionId: _r, ...rest } = raw;
    return { ...rest, regex: raw.regex, examineReuse: true } as Interaction;
  }

  if (visitingIds.has(targetId)) {
    throw new Error(
      `OBJECTS.${obj.id}: circular reuseInteractionId "${targetId}" (while resolving "${raw.id ?? raw.regex}")`,
    );
  }
  visitingIds.add(targetId);

  const baseRaw = obj.interactions.find((i) => i.id === targetId);
  if (!baseRaw) {
    throw new Error(`OBJECTS.${obj.id}: reuseInteractionId "${targetId}" not found (from "${raw.id ?? raw.regex}")`);
  }

  const base = resolveObjectInteraction(baseRaw, obj, visitingIds);
  visitingIds.delete(targetId);

  const { id: _id, reuseInteractionId: _reuse, ...overrides } = raw;
  const merged: Interaction = { ...base, ...overrides, regex: raw.regex };
  const { id: __, reuseInteractionId: ___, examineReuse: _er, ...runtime } = merged;
  return runtime as Interaction;
}

/** Match only `examine X` or `look at X` (not bare `look X`, which uses interaction text). */
function parseExamineTarget(command: string): string | null {
  let m = command.match(/^examine\s+(.+)$/i);
  if (!m) m = command.match(/^look\s+at\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim().toLowerCase().replace(/^the\s+/i, '');
}

function sceneOnLoadFlag(sceneId: string): string {
  return `__sceneOnLoad__:${sceneId}`;
}

/** After `currentSceneId` is set to `sceneId`: one-shot `onLoad`, or scene `description` for revisits / scenes without onLoad. */
function applySceneArrival(state: GameState, sceneId: string, preamble?: string): GameState {
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);
  const scene = SCENES[sceneId];
  if (!scene) {
    if (!preamble) return state;
    return { ...state, history: [...state.history, replaceName(preamble)] };
  }

  const key = sceneOnLoadFlag(sceneId);
  const onLoad = scene.onLoad;
  const firstOnLoad = Boolean(onLoad && !state.flags[key]);

  let next: GameState = { ...state, flags: { ...state.flags } };
  const parts: string[] = [];
  if (preamble) parts.push(replaceName(preamble));

  if (firstOnLoad && onLoad) {
    next.flags[key] = true;
    if (onLoad.text) parts.push(replaceName(onLoad.text));
    if (onLoad.sound) audioService.playSound(onLoad.sound);
    if (onLoad.getItem && !next.inventory.includes(onLoad.getItem)) {
      next.inventory = [...next.inventory, onLoad.getItem];
      next.uiVisible = true;
      next.pendingItem = onLoad.getItem;
      if (onLoad.getItem === 'map') next.hasMap = true;
    }
    if (onLoad.removeItem && next.inventory.includes(onLoad.removeItem)) {
      audioService.playSound('achievement');
      next.inventory = next.inventory.filter((id) => id !== onLoad.removeItem!);
    }
    if (onLoad.setFlags) {
      for (const [fk, fv] of Object.entries(onLoad.setFlags)) {
        next.flags[fk] = fv as boolean | string | number;
      }
    }
  } else {
    const desc = scene.description ? replaceName(scene.description) : '';
    if (desc) parts.push(desc);
  }

  if (parts.length) {
    next.history = [...next.history, parts.join('\n\n')];
  }

  if (scene.isCheckpoint && !next.isGameOver) {
    next.lastCheckpoint = { ...next, history: [] };
    saveCheckpoint(next);
  }

  return next;
}

/** Use when leaving the game-over screen so a bad snapshot never keeps `isGameOver` true. */
export function resumeFromGameOverSnapshot(snapshot: GameState): GameState {
  const hp = snapshot.hp <= 0 ? snapshot.maxHp : snapshot.hp;
  return {
    ...snapshot,
    isGameOver: false,
    hp,
    pendingItem: null,
  };
}

/**
 * Resume from `lastCheckpoint` with terminal feedback: system line + scene `onLoad` text/sound
 * (presentation only — does not re-run getItem/removeItem/setFlags from onLoad).
 */
export function resumeFromCheckpointWithFeedback(snapshot: GameState): GameState {
  let next = resumeFromGameOverSnapshot(snapshot);
  const replaceName = (t: string) => t.replace(/{{name}}/g, next.playerName);
  const scene = SCENES[next.currentSceneId];
  const onLoad = scene?.onLoad;
  const extra: string[] = [sysLine('Checkpoint reloaded.')];
  if (onLoad?.text) {
    extra.push(replaceName(onLoad.text));
  }
  next = { ...next, history: [...next.history, ...extra] };
  if (onLoad?.sound) {
    audioService.playSound(onLoad.sound);
  }
  return next;
}

/** Room summary / refresher (not the intro `onLoad` dump). */
function isSceneRoomRefreshCommand(command: string): boolean {
  return (
    /^explore\s+the\s+room$/i.test(command) ||
    /^examine\s+(the\s+)?(room|bedroom)$/i.test(command) ||
    /^look\s+at\s+(the\s+)?(room|bedroom)$/i.test(command)
  );
}

function dedupeIds(ids: ItemId[]): ItemId[] {
  return [...new Set(ids)];
}

/** Items that must be in inventory: explicit `requiresInventory` plus `removeItem` if present. */
function interactionRequiredItems(interaction: Interaction): ItemId[] {
  return dedupeIds([...(interaction.requiresInventory ?? []), ...(interaction.removeItem ? [interaction.removeItem] : [])]);
}

function responseRequiredItems(response: CommandResponse): ItemId[] {
  return dedupeIds([...(response.requiresInventory ?? []), ...(response.removeItem ? [response.removeItem] : [])]);
}

function inventoryAllows(state: GameState, interaction: Interaction): boolean {
  return interactionRequiredItems(interaction).every((id) => state.inventory.includes(id));
}

function responseInventoryAllows(state: GameState, response: CommandResponse): boolean {
  return responseRequiredItems(response).every((id) => state.inventory.includes(id));
}

function stripEquippedNotInInventory(state: GameState, inventory: ItemId[]): ItemId[] {
  return (state.equippedItemIds ?? []).filter((id) => inventory.includes(id));
}

function resolveItemInInventory(phrase: string, inventory: ItemId[]): ItemId | null {
  const t = phrase.trim().toLowerCase().replace(/^the\s+/i, '').replace(/\s+/g, ' ');
  if (!t) return null;
  const underscored = t.replace(/\s+/g, '_');
  for (const id of inventory) {
    if (id === underscored || id === t.replace(/\s+/g, '')) return id;
    const item = ITEMS[id];
    if (!item) continue;
    const name = item.name.toLowerCase();
    if (name === t) return id;
    if (name.replace(/\s+/g, ' ') === t) return id;
    if (name.replace(/\s+/g, '_') === underscored) return id;
  }
  if (t.length < 4) return null;
  for (const id of inventory) {
    const item = ITEMS[id];
    if (item?.name.toLowerCase().includes(t)) return id;
  }
  return null;
}

function describeSelf(state: GameState): string {
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);
  const lines: string[] = [];
  const worn = state.equippedItemIds ?? [];
  if (worn.length === 0) {
    lines.push(
      replaceName(
        "{{name}}: You're stuck in the same dinosaur pajamas you've had since you were a kid—faded fabric, stretched seams, and absolutely zero dignity left in the elastic. Nothing else equipped right now.",
      ),
    );
  } else {
    lines.push('Equipped:');
    for (const id of worn) {
      const item = ITEMS[id];
      const bit = item?.wearDescription ?? item?.name ?? id;
      lines.push(`• ${replaceName(bit)}`);
    }
  }
  return lines.join('\n\n');
}

function resolveObjectInScene(target: string, objectIds: string[]): string | null {
  const t = target.replace(/\s+/g, '_');
  for (const oid of objectIds) {
    const obj = OBJECTS[oid];
    if (!obj) continue;
    if (oid === t || oid === target.replace(/\s+/g, ' ')) return oid;
    if (obj.name.toLowerCase() === target) return oid;
    if (obj.name.toLowerCase().replace(/\s+/g, '_') === t) return oid;
    if (target === oid.replace(/_/g, ' ')) return oid;
  }
  return null;
}

/** Migrate string `objectStates.wardrobe` to multi-axis (door + contents). */
function migrateLegacyWardrobeState(state: GameState) {
  const raw = state.objectStates?.wardrobe;
  if (typeof raw !== 'string') return;
  if (raw === 'open') {
    state.objectStates!.wardrobe = { door: 'open', contents: 'empty' };
  } else {
    const hasKey = state.inventory.includes('old_key');
    state.objectStates!.wardrobe = {
      door: 'closed',
      contents: hasKey ? 'empty' : 'key',
    };
  }
}

/** Migrate string `objectStates.rug` to multi-axis (lay + contents). */
function migrateLegacyRugState(state: GameState) {
  const raw = state.objectStates?.rug;
  if (typeof raw !== 'string') return;
  const hasQuarter = state.inventory.includes('quarter');
  if (raw === 'flipped') {
    state.objectStates!.rug = { lay: 'flipped', contents: 'empty' };
  } else {
    state.objectStates!.rug = {
      lay: 'flat',
      contents: hasQuarter ? 'empty' : 'quarter',
    };
  }
}

export function loadGame(): GameState | null {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as GameState;
      // Ensure objectStates exists for older saves
      if (!parsed.objectStates) parsed.objectStates = {};
      if (parsed.focusedObjectId === undefined) parsed.focusedObjectId = undefined;
      if (!parsed.equippedItemIds) parsed.equippedItemIds = [];
      migrateLegacyWardrobeState(parsed);
      migrateLegacyRugState(parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to load game', e);
    }
  }
  return null;
}

export function saveCheckpoint(state: GameState) {
  saveGame(state);
  persistSaveSlot(state);
}

export function processCommand(state: GameState, input: string): GameState {
  const command = input.toLowerCase().trim();
  const currentScene = SCENES[state.currentSceneId];

  let newState = { ...state, history: [...state.history, `> ${input}`] };

  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);

  /**
   * Built-in commands live in a JSON-like table with regex strings.
   * (JSON can't represent RegExp directly; regexes are stored as strings and compiled.)
   */
  const BUILTIN_COMMANDS: Array<{
    id: string;
    patterns: string[]; // regex strings (without surrounding / /)
    run: (s: GameState) => GameState;
  }> = [
    {
      id: 'inventory',
      patterns: ['^(inventory|i|view\\s+inventory)$'],
      run: (s) => {
        const invItems = s.inventory.map((id) => ITEMS[id].name).join(', ');
        return { ...s, history: [...s.history, sysLine(`Inventory: ${invItems || 'Empty'}`)] };
      },
    },
    {
      id: 'map',
      patterns: ['^(map|m|view\\s+map)$'],
      run: (s) => ({ ...s, history: [...s.history, "You don't have a map yet, but you remember the layout of your house."] }),
    },
    {
      id: 'volume_up',
      patterns: ['\\b(volume\\s+up|increase\\s+volume)\\b'],
      run: (s) => {
        const vols = audioService.adjustBoth(0.1);
        saveAudioPreferences({ ...audioService.getPreferences(), ...vols });
        return {
          ...s,
          history: [
            ...s.history,
            sysLine(
              `System volume increased. BGM ${Math.round(vols.ambientVolume * 100)}% / SFX ${Math.round(vols.sfxVolume * 100)}%.`,
            ),
          ],
        };
      },
    },
    {
      id: 'volume_down',
      patterns: ['\\b(volume\\s+down|reduce\\s+volume|bg\\s+volume\\s+down)\\b'],
      run: (s) => {
        const vols = audioService.adjustBoth(-0.1);
        saveAudioPreferences({ ...audioService.getPreferences(), ...vols });
        return {
          ...s,
          history: [
            ...s.history,
            sysLine(
              `System volume reduced. BGM ${Math.round(vols.ambientVolume * 100)}% / SFX ${Math.round(vols.sfxVolume * 100)}%.`,
            ),
          ],
        };
      },
    },
    {
      id: 'mute',
      patterns: ['^mute$'],
      run: (s) => {
        audioService.toggleMute();
        saveAudioPreferences(audioService.getPreferences());
        return { ...s, history: [...s.history, sysLine('Audio muted.')] };
      },
    },
    {
      id: 'unmute',
      patterns: ['^unmute$'],
      run: (s) => {
        audioService.toggleMute();
        saveAudioPreferences(audioService.getPreferences());
        return { ...s, history: [...s.history, sysLine('Audio unmuted.')] };
      },
    },
    {
      id: 'look',
      patterns: ['^(look|l)$'],
      run: (s) => ({ ...s, history: [...s.history, replaceName(currentScene.description)] }),
    },
    {
      id: 'help',
      patterns: ['^(help|h)$'],
      run: (s) => ({
        ...s,
        history: [
          ...s.history,
          "Try commands like 'look', 'examine self', 'equip <item>', 'inventory', 'go [direction]', 'take [item]', or 'use [item] on [object]'.",
        ],
      }),
    },
    {
      id: 'examine_self',
      patterns: [
        '^examine\\s+(myself|self|me)$',
        '^look\\s+at\\s+(myself|self|me)$',
      ],
      run: (s) => ({ ...s, history: [...s.history, describeSelf(s)] }),
    },
  ];

  for (const cmd of BUILTIN_COMMANDS) {
    for (const pat of cmd.patterns) {
      const re = new RegExp(pat, 'i');
      if (re.test(command)) {
        return cmd.run(newState);
      }
    }
  }

  const equipMatch = command.match(/^equip\s+(?:the\s+)?(.+)$/i);
  if (equipMatch) {
    const phrase = equipMatch[1].trim();
    const itemId = resolveItemInInventory(phrase, newState.inventory);
    if (!itemId) {
      newState.history.push("You don't have anything like that in your inventory.");
      return newState;
    }
    const item = ITEMS[itemId];
    if (!item?.equippable) {
      newState.history.push("That isn't something you can wear.");
      return newState;
    }
    const slot = item.equipmentSlot ?? itemId;
    const prev = newState.equippedItemIds ?? [];
    const withoutSlot = prev.filter((id) => (ITEMS[id]?.equipmentSlot ?? id) !== slot);
    const equippedItemIds = dedupeIds([...withoutSlot, itemId]);
    newState.equippedItemIds = equippedItemIds;
    newState.history.push(replaceName(item.useText));
    return newState;
  }

  const unequipMatch = command.match(/^unequip\s+(?:the\s+)?(.+)$/i);
  if (unequipMatch) {
    const phrase = unequipMatch[1].trim();
    const itemId = resolveItemInInventory(phrase, newState.equippedItemIds ?? []);
    if (!itemId) {
      newState.history.push("You're not wearing anything that matches that description.");
      return newState;
    }
    newState.equippedItemIds = (newState.equippedItemIds ?? []).filter((id) => id !== itemId);
    newState.history.push(`You take off the ${ITEMS[itemId]?.name ?? itemId}.`);
    return newState;
  }

  const examineTarget = parseExamineTarget(command);
  if (examineTarget) {
    const objId = resolveObjectInScene(examineTarget, currentScene.objects);
    if (objId) {
      const obj = OBJECTS[objId];
      if (obj) {
        newState.focusedObjectId = objId;
        const axes = getObjectAxes(newState, objId, obj);
        const desc = resolveObjectDescription(obj, axes);
        if (desc) {
          newState.history.push(replaceName(desc));
          return newState;
        }
      }
    }
  }

  if (
    isSceneRoomRefreshCommand(command) &&
    (currentScene.examineRefreshText != null || currentScene.id !== 'cutscene_intro')
  ) {
    const refresh = currentScene.examineRefreshText ?? currentScene.description;
    if (refresh) {
      newState.history.push(replaceName(refresh));
      return newState;
    }
  }

  // 1. Check Object Interactions in current scene
  for (const objId of currentScene.objects) {
    const obj = OBJECTS[objId];
    if (!obj) continue;

    let inventoryBlockMessage: string | null = null;

    for (const rawInteraction of obj.interactions) {
      const interaction = resolveObjectInteraction(rawInteraction, obj);
      const regex = new RegExp(`^${interaction.regex}$`, 'i');
      if (!regex.test(command)) continue;

      const currentAxes = getObjectAxes(newState, objId, obj);
      if (!interactionWhenMatches(interaction, currentAxes, obj)) {
        continue;
      }

      if (!inventoryAllows(newState, interaction)) {
        inventoryBlockMessage =
          interaction.missingRequirementsMessage ??
          inventoryBlockMessage ??
          "You don't have what you need to do that.";
        continue;
      }

      inventoryBlockMessage = null;

      newState.focusedObjectId = objId;

      // State blurb for `examine` / `look at`, or aliases with `reuseInteractionId: "examine"`.
      const useStateDescription =
        /^examine\s+/i.test(command) ||
        /^look\s+at\s+/i.test(command) ||
        interaction.examineReuse === true;
      if (useStateDescription) {
        const stateDesc = resolveObjectDescription(obj, currentAxes);
        if (stateDesc) {
          newState.history.push(replaceName(stateDesc));
          return newState;
        }
      }

      return applyInteraction(newState, interaction, objId);
    }

    if (inventoryBlockMessage) {
      newState.history.push(replaceName(inventoryBlockMessage));
      return newState;
    }
  }

  // 2. Check Scene-specific commands (Legacy/Fallback)
  if (currentScene.commands) {
    const responseKey = Object.keys(currentScene.commands).find(key => {
      try {
        const regex = new RegExp(`^${key}$`, 'i');
        return regex.test(command);
      } catch (e) {
        return key.toLowerCase() === command;
      }
    });

    const response = responseKey ? currentScene.commands[responseKey] : undefined;
    if (response) {
      return applyResponse(newState, response);
    }
  }

  // Check for generic "take" or "use" patterns if not explicitly defined
  if (command.startsWith('take ')) {
    newState.history.push(`You can't take that right now.`);
    return newState;
  }

  if (command.startsWith('use ')) {
    newState.history.push(`I don't know how to use that here.`);
    return newState;
  }

  // Check for movement
  if (command.startsWith('go ')) {
    const direction = command.replace('go ', '').trim();
    const nextSceneId = currentScene.exits[direction];
    if (nextSceneId) {
      newState.currentSceneId = nextSceneId;
      newState = applySceneArrival(newState, nextSceneId, undefined);
      return newState;
    }
  }

  newState.history.push("Command not recognized.");
  return newState;
}

function applyInteraction(state: GameState, interaction: Interaction, objId?: string): GameState {
  let newState = { ...state, equippedItemIds: [...(state.equippedItemIds ?? [])] };
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);

  const obj = objId ? OBJECTS[objId] : undefined;
  const prevAxes = obj && objId ? getObjectAxes(state, objId, obj) : ({} as Record<string, string>);
  const legacyKey = obj?.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;

  const patch: Partial<Record<string, string>> = { ...(interaction.setAxes ?? {}) };
  if (interaction.setState !== undefined && objId && obj) {
    patch[legacyKey] = interaction.setState;
  }

  if (objId && obj && Object.keys(patch).length > 0) {
    const patchResolved = Object.fromEntries(
      Object.entries(patch).filter((e): e is [string, string] => e[1] !== undefined),
    ) as Record<string, string>;
    const actuallyChanges = Object.keys(patchResolved).some((k) => (prevAxes[k] ?? '') !== patchResolved[k]);
    if (!actuallyChanges) {
      const msg = interaction.redundantMessage ?? interaction.text ?? 'Nothing changes.';
      newState.history.push(replaceName(msg));
      return newState;
    }
    const merged = { ...prevAxes, ...patchResolved };
    newState.objectStates = { ...newState.objectStates, [objId]: merged };
  }

  if (interaction.getItem) {
    if (!newState.inventory.includes(interaction.getItem)) {
      newState.inventory = [...newState.inventory, interaction.getItem];
      newState.uiVisible = true;
      newState.pendingItem = interaction.getItem;
      if (interaction.getItem === 'map') newState.hasMap = true;
    }
  }

  if (interaction.removeItem) {
    if (newState.inventory.includes(interaction.removeItem)) {
      audioService.playSound('achievement');
    }
    newState.inventory = newState.inventory.filter((id) => id !== interaction.removeItem);
    newState.equippedItemIds = stripEquippedNotInInventory(newState, newState.inventory);
  }

  let appendDeathLine = false;

  if (interaction.damage) {
    newState.hp = Math.max(0, newState.hp - interaction.damage);
    if (newState.hp === 0) {
      newState.isGameOver = true;
      appendDeathLine = true;
    }
  }

  if (interaction.isDeath) {
    newState.isGameOver = true;
    newState.hp = 0;
    appendDeathLine = true;
  }

  if (interaction.nextScene) {
    newState.currentSceneId = interaction.nextScene;
    const nextScene = SCENES[interaction.nextScene];
    if (nextScene) {
      newState = applySceneArrival(newState, interaction.nextScene, interaction.text);
    } else if (interaction.text) {
      newState.history.push(replaceName(interaction.text));
    }
  } else if (interaction.text) {
    newState.history.push(replaceName(interaction.text));
  }

  if (appendDeathLine) {
    newState.history.push(fatalLine('YOU HAVE DIED.'));
  }

  if (interaction.callback) {
    newState = interaction.callback(newState);
  }

  if (interaction.playSound) {
    audioService.playSound(interaction.playSound);
  }

  return newState;
}

function applyResponse(state: GameState, response: CommandResponse): GameState {
  let newState = { ...state, equippedItemIds: [...(state.equippedItemIds ?? [])] };
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);
  if (!responseInventoryAllows(newState, response)) {
    const msg = response.missingRequirementsMessage ?? "You don't have what you need to do that.";
    newState.history.push(replaceName(msg));
    return newState;
  }

  if (response.getItem) {
    if (!newState.inventory.includes(response.getItem)) {
      newState.inventory = [...newState.inventory, response.getItem];
      newState.uiVisible = true;
      newState.pendingItem = response.getItem;
      if (response.getItem === 'map') newState.hasMap = true;
    }
  }

  if (response.removeItem) {
    if (newState.inventory.includes(response.removeItem)) {
      audioService.playSound('achievement');
    }
    newState.inventory = newState.inventory.filter((id) => id !== response.removeItem);
    newState.equippedItemIds = stripEquippedNotInInventory(newState, newState.inventory);
  }

  let appendDeathLine = false;

  if (response.damage) {
    newState.hp = Math.max(0, newState.hp - response.damage);
    if (newState.hp === 0) {
      newState.isGameOver = true;
      appendDeathLine = true;
    }
  }

  if (response.isDeath) {
    newState.isGameOver = true;
    newState.hp = 0;
    appendDeathLine = true;
  }

  if (response.nextScene) {
    newState.currentSceneId = response.nextScene;
    const nextScene = SCENES[response.nextScene];
    if (nextScene) {
      newState = applySceneArrival(newState, response.nextScene, response.text);
    } else if (response.text) {
      newState.history.push(replaceName(response.text));
    }
  } else if (response.text) {
    newState.history.push(replaceName(response.text));
  }

  if (appendDeathLine) {
    newState.history.push(fatalLine('YOU HAVE DIED.'));
  }

  if (response.callback) {
    newState = response.callback(newState);
  }

  return newState;
}
