import {
  GameState,
  CommandResponse,
  GameObject,
  Interaction,
  ItemId,
  REUSE_INTERACTION_EXAMINE,
  SetPromptSpec,
} from '../types';
import { SCENES, ITEMS, OBJECTS, INITIAL_STATE, runSceneEnterHook } from '../gameData';
import { audioService, saveAudioPreferences } from './audioService';
import { SCORE_FIRST_ENTER_SCENE, SCORE_PICKUP_ITEM } from './gameScoring';
import { getSceneAreaDisplayLabel } from './sceneAreaLabel';
import { buildDicebearAvatarUrl, loadDicebearProfile } from './dicebearAvatar';
import { loadLocalAvatar } from './localAvatar';
import { getHelpText } from './helpText';
import { transitionIntoScene } from './engine/sceneTransition';
import { ACTION_ACHIEVEMENT_AWARDS } from './achievements';
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
  /** Display-only: `{CC}X{SCENE}` at save time (helps debug & quick recognition). */
  areaLabel?: string;
  /** Snapshot avatar at save time (stable in Load dialog). */
  avatarSrc?: string;
  /** User-editable label shown in the load dialog (optional). */
  note?: string;
  /** Score snapshot at save time. */
  score?: number;
}

interface SaveSlotRecord extends SaveSlotSummary {
  state: GameState;
}

export type GameEngineEffect =
  | { type: 'history.append'; lines: string[] }
  | { type: 'scene.changed'; fromSceneId: string; toSceneId: string }
  | { type: 'inventory.changed'; added: ItemId[]; removed: ItemId[] }
  | { type: 'gameover.changed'; isGameOver: boolean };

export interface TransitionResult {
  state: GameState;
  effects: GameEngineEffect[];
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
      .map(({ id, savedAt, sceneId, playerName, note, areaLabel, avatarSrc, score, state }) => ({
        id,
        savedAt,
        sceneId,
        playerName,
        areaLabel:
          typeof areaLabel === 'string' && areaLabel.trim() !== ''
            ? areaLabel.trim()
            : state
              ? getSceneAreaDisplayLabel(state, sceneId)
              : undefined,
        ...(typeof avatarSrc === 'string' && avatarSrc.trim() !== '' ? { avatarSrc: avatarSrc.trim() } : {}),
        ...(typeof note === 'string' && note.trim() !== '' ? { note: note.trim() } : {}),
        ...(typeof score === 'number' && !Number.isNaN(score)
          ? { score }
          : typeof state?.score === 'number' && !Number.isNaN(state.score)
            ? { score: state.score }
            : {}),
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
    migrateModernGameplayFields(rec.state);
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
  const localAvatar = loadLocalAvatar();
  const profile = loadDicebearProfile();
  const seedFromState = [state.playerName, ...(state.equippedItemIds ?? [])].join('|');
  const avatarSrc =
    localAvatar?.kind === 'photo'
      ? localAvatar.dataUrl
      : buildDicebearAvatarUrl(localAvatar?.kind === 'dicebear' ? localAvatar.seed : seedFromState, profile);
  const record: SaveSlotRecord = {
    id,
    savedAt: now,
    sceneId: state.currentSceneId,
    playerName: state.playerName,
    areaLabel: getSceneAreaDisplayLabel(state, state.currentSceneId),
    score: state.score ?? 0,
    avatarSrc,
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
    return { ...raw, reuseInteractionId: undefined } as Interaction;
  }

  if (targetId === REUSE_INTERACTION_EXAMINE) {
    return { ...raw, regex: raw.regex, reuseInteractionId: undefined, examineReuse: true } as Interaction;
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

  const { reuseInteractionId: _reuse, ...overrides } = raw;
  const merged: Interaction = { ...base, ...overrides, regex: raw.regex };
  return { ...merged, reuseInteractionId: undefined } as Interaction;
}

/** Match only `examine X` or `look at X` (not bare `look X`, which uses interaction text). */
function parseExamineTarget(command: string): string | null {
  let m = command.match(/^examine\s+(.+)$/i);
  if (!m) m = command.match(/^look\s+at\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim().toLowerCase().replace(/^the\s+/i, '');
}

function normalizePromptKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '');
}

function normalizePromptAliases(spec: SetPromptSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(spec.aliases)) {
    out[normalizePromptKey(k)] = v;
  }
  return out;
}

function clearDeadlineFields(s: GameState): GameState {
  return {
    ...s,
    deadlineAtMs: undefined,
    deadlineSceneId: undefined,
    deadlineReason: undefined,
    deadlineTurnsLeft: undefined,
  };
}

/** Wall-clock / turn deadline fired at the start of a player command. */
export function applyDeadlineExpired(state: GameState): GameState {
  if (state.isGameOver) return state;
  if (!state.deadlineSceneId || state.currentSceneId !== state.deadlineSceneId) return state;
  const replaceName = (t: string) => t.replace(/{{name}}/g, state.playerName);
  const cleared = clearDeadlineFields({ ...state, pendingPrompt: undefined });
  const reason = state.deadlineReason;
  let lines: string[];
  if (reason === 'wizard_melt') {
    lines = [
      'Your hesitancy has cost you dearly...',
      'The wizard. Sensing your apprehension, unleashes a fatal bolt from the ice scepter.',
      'With luck, you will thaw in several million years.',
    ];
  } else {
    lines = [
      'Your hesitancy has cost you dearly...',
      'Footsteps thunder on the landing. You wasted the only window you had.',
    ];
  }
  return revertProgressStatsToCheckpoint({
    ...cleared,
    history: [...cleared.history, ...lines.map(replaceName), fatalLine('YOU HAVE DIED.')],
    isGameOver: true,
    hp: 0,
  });
}

function checkDeadlineAtCommandStart(s: GameState): GameState | null {
  if (s.isGameOver) return null;
  if (!s.deadlineSceneId || s.currentSceneId !== s.deadlineSceneId) return null;
  const timeExpired = s.deadlineAtMs !== undefined && Date.now() > s.deadlineAtMs;
  const turnsExpired = s.deadlineTurnsLeft !== undefined && s.deadlineTurnsLeft <= 0;
  if (!timeExpired && !turnsExpired) return null;
  return applyDeadlineExpired(s);
}

function applyScoreDelta(state: GameState, delta?: number): GameState {
  if (delta === undefined || delta === 0) return state;
  return { ...state, score: (state.score ?? 0) + delta };
}

function applyAchievementAwardForAction(state: GameState, actionKey?: string): GameState {
  if (!actionKey) return state;
  const award = ACTION_ACHIEVEMENT_AWARDS[actionKey];
  if (!award) return state;
  const delta = Math.max(1, award.delta ?? 1);
  const prevLevels = state.achievementLevels ?? {};
  const prevLevel = Math.max(0, prevLevels[award.achievementId] ?? 0);
  const nextLevel = prevLevel + delta;
  const next: GameState = {
    ...state,
    achievementLevels: {
      ...prevLevels,
      [award.achievementId]: nextLevel,
    },
  };
  if (prevLevel === 0) {
    next.pendingAchievementQueue = [...(next.pendingAchievementQueue ?? []), { id: award.achievementId }];
  }
  // Subtle reinforcement on every achievement-related action (including level-ups).
  audioService.playSound('terminal_blip');
  return next;
}

/**
 * Award `scoreDelta` once per stable action key (interaction/scene command), preventing
 * score farming from repeated identical commands.
 */
function applyScoreDeltaOnce(state: GameState, delta: number | undefined, actionKey?: string): GameState {
  if (delta === undefined || delta === 0) return state;
  if (!actionKey) return applyScoreDelta(state, delta);
  const scoreFlag = `__scoreAwarded__:${actionKey}`;
  if (state.flags[scoreFlag]) return state;
  const next = {
    ...state,
    score: (state.score ?? 0) + delta,
    flags: { ...state.flags, [scoreFlag]: true },
  };
  return applyAchievementAwardForAction(next, actionKey);
}

function interactionScoreActionKey(objId: string | undefined, interaction: Interaction): string | undefined {
  if (!objId) return undefined;
  if (interaction.id) return `interaction:${objId}:${interaction.id}`;
  if (interaction.regex) return `interaction:${objId}:${interaction.regex}`;
  return undefined;
}

function sceneCommandScoreActionKey(sceneId: string, commandKey: string): string {
  return `scene_command:${sceneId}:${commandKey}`;
}

function applySetPromptFromSpec(state: GameState, spec?: SetPromptSpec): GameState {
  if (!spec) return state;
  return {
    ...state,
    pendingPrompt: {
      id: spec.id,
      expiresAtMs: spec.expiresAtMs,
      aliases: normalizePromptAliases(spec),
    },
  };
}

function postCommandTurn(
  preCmdState: GameState,
  result: GameState,
  pendingAliasConsumed: boolean,
): GameState {
  let next = result;
  if (
    !pendingAliasConsumed &&
    preCmdState.pendingPrompt &&
    next.pendingPrompt &&
    next.pendingPrompt.id === preCmdState.pendingPrompt.id
  ) {
    next = { ...next, pendingPrompt: undefined };
  }
  if (next.isGameOver) return next;
  const hadTurnDeadline =
    preCmdState.deadlineSceneId &&
    preCmdState.currentSceneId === preCmdState.deadlineSceneId &&
    preCmdState.deadlineTurnsLeft !== undefined;
  if (
    hadTurnDeadline &&
    next.deadlineSceneId &&
    next.currentSceneId === next.deadlineSceneId &&
    next.deadlineTurnsLeft !== undefined
  ) {
    return { ...next, deadlineTurnsLeft: Math.max(0, next.deadlineTurnsLeft - 1) };
  }
  return next;
}

function migrateModernGameplayFields(state: GameState) {
  if (typeof state.score !== 'number' || Number.isNaN(state.score)) state.score = 0;
  if (!Array.isArray(state.pendingItemQueue)) state.pendingItemQueue = [];
  if (!state.achievementLevels || typeof state.achievementLevels !== 'object') state.achievementLevels = {};
  if (!Array.isArray(state.pendingAchievementQueue)) state.pendingAchievementQueue = [];
}

/**
 * On death, cumulative score (and any future economy fields mirrored on `lastCheckpoint`) should match
 * the last save point — the doomed run does not keep points earned after that checkpoint.
 */
function revertProgressStatsToCheckpoint(state: GameState): GameState {
  const cp = state.lastCheckpoint;
  if (!cp) return state;
  return {
    ...state,
    score: cp.score ?? 0,
  };
}

function isBedroomDoorUnlocked(state: GameState): boolean {
  const door = OBJECTS.door;
  if (!door) return true;
  const axes = getObjectAxes(state, 'door', door);
  const lk = door.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
  return (axes[lk] ?? door.initialState) === 'unlocked';
}

function getPlaypenSisterState(state: GameState): string {
  const playpen = OBJECTS.playpen;
  if (!playpen) return 'quiet';
  const axes = getObjectAxes(state, 'playpen', playpen);
  const key = playpen.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
  return (axes[key] ?? playpen.initialState) as string;
}

function syncLoopingSceneAudio(state: GameState) {
  // Parents' bedroom: loop crying until sister is quiet.
  if (state.currentSceneId === 'parents_bedroom') {
    const sister = getPlaypenSisterState(state);
    if (sister !== 'quiet') {
      audioService.startLoopingSound('crying_child');
      return;
    }
  }
  audioService.stopLoopingSound('crying_child');
}

/**
 * After `currentSceneId` is set to `sceneId`: one-shot `onLoad`, or scene `description` for revisits / scenes without onLoad.
 * `implicitCarry` — implicit score already earned this command (e.g. interaction pickup) merged into this arrival’s score bump.
 * SFX: only `onLoad.sound` / interaction `playSound` etc.; no automatic fanfare for implicit score.
 */
function applySceneArrival(
  state: GameState,
  sceneId: string,
  preamble?: string,
  fromSceneId?: string,
  implicitCarry = 0,
): GameState {
  const beforeInventory = [...state.inventory];
  const transition = transitionIntoScene(
    {
      scenes: SCENES,
      items: ITEMS,
      scorePickupItem: SCORE_PICKUP_ITEM,
      scoreFirstEnterScene: SCORE_FIRST_ENTER_SCENE,
      runSceneEnterHook,
    },
    {
      state,
      sceneId,
      preamble,
      fromSceneId,
      implicitCarry,
      includeSceneHooks: true,
    },
  );

  for (const soundId of transition.soundsToPlay) {
    audioService.playSound(soundId);
  }

  let next = transition.state;
  if (transition.shouldCheckpoint) {
    next.lastCheckpoint = { ...next, history: [] };
    saveCheckpoint(next);
  }

  return queueNewInventoryAnimations(beforeInventory, next);
}

/** Use when leaving the game-over screen so a bad snapshot never keeps `isGameOver` true. */
export function resumeFromGameOverSnapshot(snapshot: GameState): GameState {
  const hp = snapshot.hp <= 0 ? snapshot.maxHp : snapshot.hp;
  return {
    ...snapshot,
    isGameOver: false,
    hp,
    pendingItem: null,
    pendingItemQueue: [],
    pendingPrompt: undefined,
    deadlineAtMs: undefined,
    deadlineSceneId: undefined,
    deadlineReason: undefined,
    deadlineTurnsLeft: undefined,
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

function equipSlotKey(itemId: ItemId): string {
  const it = ITEMS[itemId];
  if (!it) return itemId;
  const itemType = it.itemType ?? (it.equippable ? 'gear' : 'misc');
  if (itemType === 'weapon') {
    return it.weaponHand === 'left' ? 'left_hand' : 'right_hand';
  }
  return (it.gearSlot ?? it.equipmentSlot ?? itemId) as string;
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

function itemAnimationTarget(itemId: ItemId): 'inventory' | 'equipment' {
  const it = ITEMS[itemId];
  const t = it?.itemType ?? (it?.equippable ? 'gear' : 'misc');
  return t === 'gear' || t === 'weapon' ? 'equipment' : 'inventory';
}

function isMapItemId(itemId: ItemId): boolean {
  return itemId === 'map' || itemId === 'world_map';
}

function currentRegionLabel(sceneId: string): string {
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
    return 'ICE REGION';
  }
  if (sceneId === 'crossroads' || sceneId === 'crossroads_map_overlook') return 'CROSSROADS';
  if (sceneId.startsWith('water_')) return 'WATER REGION';
  if (sceneId.startsWith('fire_')) return 'FIRE REGION';
  if (sceneId.startsWith('summit_') || sceneId === 'final_wizard_arena') return 'SUMMIT';
  if (sceneId === 'fairgrounds' || sceneId.startsWith('cutscene_')) return 'OUTER REALM';
  return 'HOUSE';
}

function mapLine(label: string, discovered: boolean, current: boolean): string {
  if (!discovered && !current) return `${label}: ???`;
  return `${label}: ${current ? '[YOU ARE HERE]' : 'DISCOVERED'}`;
}

function buildMapView(state: GameState): string {
  const current = currentRegionLabel(state.currentSceneId);
  const discovered = {
    crossroads: Boolean(state.flags.visited_crossroads),
    ice: Boolean(state.flags.visited_ice_region),
    water: Boolean(state.flags.visited_water_region),
    fire: Boolean(state.flags.visited_fire_region),
    summit: Boolean(state.flags.visited_summit_region),
  };
  const lines = [
    'WORLD MAP (ZOLTAR EDITION)',
    `CURRENT REGION: ${current}`,
    '',
    mapLine('CENTER  - CROSSROADS', discovered.crossroads, current === 'CROSSROADS'),
    mapLine('NORTH   - ICE DWARF VILLAGE', discovered.ice, current === 'ICE REGION'),
    mapLine('WEST    - WATER DWARF VILLAGE', discovered.water, current === 'WATER REGION'),
    mapLine('SOUTH   - FIRE DWARF VILLAGE', discovered.fire, current === 'FIRE REGION'),
    mapLine('EAST    - SUMMIT', discovered.summit, current === 'SUMMIT'),
  ];
  return lines.join('\n');
}

function queueNewInventoryAnimations(prevInventory: ItemId[], state: GameState): GameState {
  const prevSet = new Set(prevInventory);
  const added = state.inventory.filter((id) => !prevSet.has(id));
  if (!added.length) return state;
  const appended: Array<{ id: ItemId; target: 'inventory' | 'equipment' }> = added.map((id) => ({
    id,
    target: itemAnimationTarget(id),
  }));
  return {
    ...state,
    pendingItem: state.pendingItem ?? added[0] ?? null,
    pendingItemQueue: [...(state.pendingItemQueue ?? []), ...appended],
  };
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

/** Matches the Equipment dialog: gear slots + left/right weapon hands. */
export type DerivedGearSlot = 'head' | 'torso' | 'hands' | 'legs' | 'feet';
export type DerivedWeaponHand = 'left' | 'right';

export function deriveEquippedSlots(state: GameState): {
  gear: Partial<Record<DerivedGearSlot, ItemId>>;
  weapons: Partial<Record<DerivedWeaponHand, ItemId>>;
} {
  const gear: Partial<Record<DerivedGearSlot, ItemId>> = {};
  const weapons: Partial<Record<DerivedWeaponHand, ItemId>> = {};
  for (const id of state.equippedItemIds ?? []) {
    const it = ITEMS[id];
    if (!it) continue;
    if (it.itemType === 'weapon') {
      const hand = (it.weaponHand ?? 'right') as DerivedWeaponHand;
      weapons[hand] = id;
      continue;
    }
    const slot = (it.gearSlot ?? (it.equipmentSlot as DerivedGearSlot | undefined)) as DerivedGearSlot | undefined;
    if (slot) gear[slot] = id;
  }
  return { gear, weapons };
}

function describeSelf(state: GameState): string {
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);
  const pajamasLine =
    "{{name}} — The dinosaur underwear you've worn since forever—faded, stretched, and stubbornly familiar.";
  const equipped = state.equippedItemIds ?? [];
  const { gear, weapons } = deriveEquippedSlots(state);
  const inventory = state.inventory ?? [];
  const hasSlotItem = (slot: DerivedGearSlot) =>
    inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === slot;
    });
  const hasWeaponItem = inventory.some((id) => ITEMS[id]?.itemType === 'weapon');
  const showHead = Boolean(gear.head) || hasSlotItem('head');
  const showTorso = Boolean(gear.torso) || hasSlotItem('torso');
  const showHands = Boolean(gear.hands) || hasSlotItem('hands');
  const showLegs = Boolean(gear.legs) || hasSlotItem('legs');
  const showFeet = Boolean(gear.feet) || hasSlotItem('feet');
  const showWeapons = Boolean(weapons.left || weapons.right) || hasWeaponItem;
  const anyVisibleSlots = showHead || showTorso || showHands || showLegs || showFeet || showWeapons;

  if (!anyVisibleSlots) {
    if (equipped.length === 0) {
      return replaceName(pajamasLine);
    }
    const names = equipped.map((id) => ITEMS[id]?.name ?? id).join(', ');
    return `${replaceName(pajamasLine)}\n\nEquipped: ${names}.`;
  }

  const slotName = (id?: ItemId) => {
    if (!id || !ITEMS[id]) return '—';
    return ITEMS[id].name;
  };
  const lines: string[] = ['Equipped:'];
  if (showHead) lines.push(`Head:        ${slotName(gear.head)}`);
  if (showTorso) lines.push(`Torso:       ${slotName(gear.torso)}`);
  if (showWeapons) lines.push(`Left hand:   ${slotName(weapons.left)}`);
  if (showWeapons) lines.push(`Right hand:  ${slotName(weapons.right)}`);
  if (showHands) lines.push(`Hands:       ${slotName(gear.hands)}`);
  if (showLegs) lines.push(`Legs:        ${slotName(gear.legs)}`);
  if (showFeet) lines.push(`Feet:        ${slotName(gear.feet)}`);
  return lines.join('\n');
}

function normalizeObjectLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/['`"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

function resolveObjectInScene(target: string, objectIds: string[]): string | null {
  const t = normalizeObjectLookupKey(target);
  for (const oid of objectIds) {
    const obj = OBJECTS[oid];
    if (!obj) continue;
    const oidNorm = normalizeObjectLookupKey(oid);
    const nameNorm = normalizeObjectLookupKey(obj.name);
    if (oidNorm === t || nameNorm === t) return oid;
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
      migrateModernGameplayFields(parsed);
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
  const displayLine = input.trim();
  if (!displayLine) return state;

  let base = state;
  if (base.pendingPrompt?.expiresAtMs && Date.now() > base.pendingPrompt.expiresAtMs) {
    base = { ...base, pendingPrompt: undefined };
  }

  if (!base.isGameOver) {
    const deadlineDeath = checkDeadlineAtCommandStart(base);
    if (deadlineDeath) {
      return {
        ...revertProgressStatsToCheckpoint(deadlineDeath),
        history: [...deadlineDeath.history, `> ${displayLine}`],
      };
    }
  }

  let effectiveLine = displayLine;
  let pendingAliasConsumed = false;
  if (base.pendingPrompt) {
    const norm = normalizePromptKey(displayLine);
    const mapped = base.pendingPrompt.aliases[norm];
    if (mapped) {
      effectiveLine = mapped.trim();
      pendingAliasConsumed = true;
      base = { ...base, pendingPrompt: undefined };
    }
  }

  const preCmdStateForTurn = base;
  const finish = (out: GameState) => {
    const afterDeath =
      out.isGameOver ? revertProgressStatsToCheckpoint(out) : out;
    if (!preCmdStateForTurn.isGameOver && afterDeath.isGameOver) {
      audioService.playSound('death_rattle');
    }
    syncLoopingSceneAudio(afterDeath);
    return postCommandTurn(preCmdStateForTurn, afterDeath, pendingAliasConsumed);
  };

  const command = effectiveLine.toLowerCase().trim();
  const currentScene = SCENES[base.currentSceneId];

  let newState = { ...base, history: [...base.history, `> ${displayLine}`] };

  const replaceName = (text: string) => text.replace(/{{name}}/g, base.playerName);

  if (base.isGameOver) {
    if (/^(help|h)$/i.test(command)) {
      newState.history.push(getHelpText(currentScene));
      return finish(newState);
    }
    if (/^(reload( last)? checkpoint|load checkpoint|continue)$/i.test(command)) {
      if (!base.lastCheckpoint) {
        newState.history.push(sysLine('No checkpoint available to reload.'));
        return finish(newState);
      }
      return finish(resumeFromCheckpointWithFeedback(base.lastCheckpoint));
    }
    if (/^(settings|open settings)$/i.test(command)) {
      newState.history.push(sysLine('Open SETTINGS from the sidebar button.'));
      return finish(newState);
    }
    if (/^(reboot|restart|system reboot)$/i.test(command)) {
      newState.history.push(sysLine('Use SYSTEM_REBOOT from the footer to restart.'));
      return finish(newState);
    }
    newState.history.push('Command not recognized.');
    return finish(newState);
  }

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
      id: 'score',
      patterns: ['^(score|points)$'],
      run: (s) => ({ ...s, history: [...s.history, sysLine(`Score: ${s.score ?? 0}`)] }),
    },
    {
      id: 'map',
      patterns: ['^(map|m|view\\s+map)$'],
      run: (s) => {
        if (!s.hasMap) {
          return {
            ...s,
            history: [...s.history, "You don't have a map yet. For now, you're navigating by memory and panic."],
          };
        }
        return { ...s, history: [...s.history, buildMapView(s)] };
      },
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
        history: [...s.history, getHelpText(currentScene)],
      }),
    },
    {
      id: 'examine_self',
      patterns: [
        '^examine\\s+(myself|self|me)$',
        '^look\\s+at\\s+(myself|self|me)$',
      ],
      run: (s) => {
        const withText = { ...s, history: [...s.history, describeSelf(s)] };
        return applyScoreDeltaOnce(withText, 10, 'builtin:examine_self');
      },
    },
  ];

  for (const cmd of BUILTIN_COMMANDS) {
    for (const pat of cmd.patterns) {
      const re = new RegExp(pat, 'i');
      if (re.test(command)) {
        return finish(cmd.run(newState));
      }
    }
  }

  const equipMatch = command.match(/^equip\s+(?:the\s+)?(.+)$/i);
  if (equipMatch) {
    const phrase = equipMatch[1].trim();
    const itemId = resolveItemInInventory(phrase, newState.inventory);
    if (!itemId) {
      newState.history.push("You don't have anything like that in your inventory.");
      return finish(newState);
    }
    const item = ITEMS[itemId];
    const itemType = item?.itemType ?? (item?.equippable ? 'gear' : 'misc');
    if (!item || (itemType !== 'gear' && itemType !== 'weapon')) {
      newState.history.push("That isn't something you can equip.");
      return finish(newState);
    }
    const slot = equipSlotKey(itemId);
    const prev = newState.equippedItemIds ?? [];
    const withoutSlot = prev.filter((id) => equipSlotKey(id) !== slot);
    const equippedItemIds = dedupeIds([...withoutSlot, itemId]);
    newState.equippedItemIds = equippedItemIds;
    newState.history.push(replaceName(item.useText));
    return finish(newState);
  }

  const unequipMatch = command.match(/^unequip\s+(?:the\s+)?(.+)$/i);
  if (unequipMatch) {
    const phrase = unequipMatch[1].trim();
    const itemId = resolveItemInInventory(phrase, newState.equippedItemIds ?? []);
    if (!itemId) {
      newState.history.push("You're not wearing anything that matches that description.");
      return finish(newState);
    }
    newState.equippedItemIds = (newState.equippedItemIds ?? []).filter((id) => id !== itemId);
    newState.history.push(`You take off the ${ITEMS[itemId]?.name ?? itemId}.`);
    return finish(newState);
  }

  const examineTarget = parseExamineTarget(command);
  if (examineTarget) {
    const itemId = resolveItemInInventory(examineTarget, newState.inventory);
    if (itemId) {
      const item = ITEMS[itemId];
      newState.history.push(item?.description ?? `You examine the ${item?.name ?? itemId}.`);
      return finish(newState);
    }
    const objId = resolveObjectInScene(examineTarget, currentScene.objects);
    if (objId) {
      const obj = OBJECTS[objId];
      if (obj) {
        newState.focusedObjectId = objId;
        const axes = getObjectAxes(newState, objId, obj);
        const desc = resolveObjectDescription(obj, axes);
        if (desc) {
          newState.history.push(replaceName(desc));
          return finish(newState);
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
      return finish(newState);
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
          return finish(newState);
        }
      }

      return finish(applyInteraction(newState, interaction, objId));
    }

    if (inventoryBlockMessage) {
      newState.history.push(replaceName(inventoryBlockMessage));
      return finish(newState);
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
      const scoreActionKey = responseKey
        ? sceneCommandScoreActionKey(currentScene.id, responseKey)
        : undefined;
      return finish(applyResponse(newState, response, scoreActionKey));
    }
  }

  // Check for generic "take" or "use" patterns if not explicitly defined
  if (command.startsWith('take ')) {
    newState.history.push(`You can't take that right now.`);
    return finish(newState);
  }

  if (command.startsWith('use ')) {
    newState.history.push(`I don't know how to use that here.`);
    return finish(newState);
  }

  // Movement: same exit table as `go <dir>`, also accepts `walk` / `head`.
  const moveMatch = command.match(/^(go|walk|head)\s+(.+)$/i);
  if (moveMatch) {
    const direction = moveMatch[2].trim().toLowerCase();
    const nextSceneId = currentScene.exits[direction];
    if (nextSceneId) {
      if (newState.currentSceneId === 'bedroom' && nextSceneId === 'hallway' && !isBedroomDoorUnlocked(newState)) {
        newState.history.push(
          "The door to the hall won't open—it's locked from the outside. You'll need a key (or another way) before you can leave.",
        );
        return finish(newState);
      }
      const fromSceneId = newState.currentSceneId;
      newState.currentSceneId = nextSceneId;
      newState = applySceneArrival(newState, nextSceneId, undefined, fromSceneId);
      return finish(newState);
    }
  }

  // Replay cutscene option narration in the destination gameplay scene.
  // Only applies to cutscene options that emit text and resolve into a non-cutscene scene.
  const cutsceneReplayText = resolveCutsceneCommandReplayText(newState.currentSceneId, command, replaceName);
  if (cutsceneReplayText) {
    newState.history.push(cutsceneReplayText);
    return finish(newState);
  }

  newState.history.push("Command not recognized.");
  return finish(newState);
}

function resolveCutsceneCommandReplayText(
  currentSceneId: string,
  command: string,
  replaceName: (text: string) => string,
): string | null {
  for (const scene of Object.values(SCENES)) {
    if (!scene.id.startsWith('cutscene_') || !scene.commands) continue;
    for (const [key, response] of Object.entries(scene.commands)) {
      if (!response.text || !response.nextScene) continue;
      if (response.nextScene !== currentSceneId) continue;
      if (response.nextScene.startsWith('cutscene_')) continue;
      try {
        const regex = new RegExp(`^${key}$`, 'i');
        if (regex.test(command)) return replaceName(response.text);
      } catch {
        if (key.toLowerCase() === command.toLowerCase()) return replaceName(response.text);
      }
    }
  }
  return null;
}

function diffInventory(before: ItemId[], after: ItemId[]): { added: ItemId[]; removed: ItemId[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((id) => !beforeSet.has(id)),
    removed: before.filter((id) => !afterSet.has(id)),
  };
}

/**
 * Transitional engine API: emits typed effects so UI and adapters can consume
 * state changes without parsing raw game state diffs.
 */
export function transitionCommand(state: GameState, input: string): TransitionResult {
  const next = processCommand(state, input);
  const effects: GameEngineEffect[] = [];
  const appended = next.history.slice(state.history.length);
  if (appended.length > 0) {
    effects.push({ type: 'history.append', lines: appended });
  }
  if (state.currentSceneId !== next.currentSceneId) {
    effects.push({
      type: 'scene.changed',
      fromSceneId: state.currentSceneId,
      toSceneId: next.currentSceneId,
    });
  }
  const inv = diffInventory(state.inventory ?? [], next.inventory ?? []);
  if (inv.added.length > 0 || inv.removed.length > 0) {
    effects.push({ type: 'inventory.changed', ...inv });
  }
  if (state.isGameOver !== next.isGameOver) {
    effects.push({ type: 'gameover.changed', isGameOver: next.isGameOver });
  }
  return { state: next, effects };
}

/** Same outcome as typing `equip <item name>` (e.g. from the Equipment dialog). */
export function equipItemFromInventory(state: GameState, itemId: ItemId): GameState {
  const item = ITEMS[itemId];
  if (!item) return state;
  return processCommand(state, `equip ${item.name}`);
}

function applyInteraction(state: GameState, interaction: Interaction, objId?: string): GameState {
  let newState = { ...state, equippedItemIds: [...(state.equippedItemIds ?? [])] };
  const beforeInventory = [...state.inventory];
  let implicitScore = 0;
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);
  const scoreActionKey = interactionScoreActionKey(objId, interaction);

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
      if (isMapItemId(interaction.getItem)) {
        newState.hasMap = true;
        newState.flags = { ...newState.flags, map_unlocked: true };
      }
      implicitScore += SCORE_PICKUP_ITEM;
    }
  }

  if (interaction.removeItem) {
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
    const fromSceneId = state.currentSceneId;
    newState.currentSceneId = interaction.nextScene;
    const nextScene = SCENES[interaction.nextScene];
    if (nextScene) {
      const carryImplicit = implicitScore;
      implicitScore = 0;
      newState = applySceneArrival(newState, interaction.nextScene, interaction.text, fromSceneId, carryImplicit);
    } else {
      if (interaction.text) {
        newState.history.push(replaceName(interaction.text));
      }
      newState = { ...newState, focusedObjectId: undefined };
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

  if (interaction.clearDeadline) {
    newState = clearDeadlineFields(newState);
  }
  if (interaction.setDeadline) {
    const d = interaction.setDeadline;
    newState = {
      ...newState,
      deadlineAtMs: Date.now() + d.deadlineMsFromNow,
      deadlineTurnsLeft: d.deadlineTurnsLeft,
      deadlineSceneId: d.deadlineSceneId,
      deadlineReason: d.deadlineReason,
    };
  }
  newState = applyScoreDeltaOnce(newState, interaction.scoreDelta, scoreActionKey);
  if (implicitScore > 0) {
    newState = { ...newState, score: (newState.score ?? 0) + implicitScore };
  }
  newState = applySetPromptFromSpec(newState, interaction.setPrompt);

  return queueNewInventoryAnimations(beforeInventory, newState);
}

function applyResponse(state: GameState, response: CommandResponse, scoreActionKey?: string): GameState {
  let newState = { ...state, equippedItemIds: [...(state.equippedItemIds ?? [])] };
  const beforeInventory = [...state.inventory];
  let implicitScore = 0;
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
      if (isMapItemId(response.getItem)) {
        newState.hasMap = true;
        newState.flags = { ...newState.flags, map_unlocked: true };
      }
      implicitScore += SCORE_PICKUP_ITEM;
    }
  }

  if (response.removeItem) {
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
    const fromSceneId = state.currentSceneId;
    newState.currentSceneId = response.nextScene;
    const nextScene = SCENES[response.nextScene];
    if (nextScene) {
      const carryImplicit = implicitScore;
      implicitScore = 0;
      newState = applySceneArrival(newState, response.nextScene, response.text, fromSceneId, carryImplicit);
    } else {
      if (response.text) {
        newState.history.push(replaceName(response.text));
      }
      newState = { ...newState, focusedObjectId: undefined };
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

  if (response.clearDeadline) {
    newState = clearDeadlineFields(newState);
  }
  newState = applyScoreDeltaOnce(newState, response.scoreDelta, scoreActionKey);
  if (implicitScore > 0) {
    newState = { ...newState, score: (newState.score ?? 0) + implicitScore };
  }
  newState = applySetPromptFromSpec(newState, response.setPrompt);

  return queueNewInventoryAnimations(beforeInventory, newState);
}
