/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemId = string;
export type ObjectId = string;

/**
 * Sound effect id (string key). Valid keys are whatever you register in `audioService`’s URL map
 * — add new entries there only; no need to update this file when adding sounds.
 */
export type GameSfxId = string;

/** One SFX id or several played in order when each clip ends. */
export type GameSfxSpec = GameSfxId | GameSfxId[];

export interface SceneOnLoad {
  text?: string;
  sound?: GameSfxSpec;
  getItem?: ItemId;
  removeItem?: ItemId;
  setFlags?: Record<string, boolean | string | number>;
}

/**
 * Narrow follow-up prompt: next player line is matched against `aliases` keys (normalized);
 * on match, input is rewritten to the alias value (canonical command) before parsing.
 */
export interface SetPromptSpec {
  id: string;
  /** If set, prompt clears automatically after this epoch ms (checked in `processCommand`). */
  expiresAtMs?: number;
  /** Map of normalized player phrase -> canonical command string. */
  aliases: Record<string, string>;
}

export type DeadlineReason = 'hallway_hurry' | 'wizard_melt' | string;

export interface PendingPrompt {
  id: string;
  expiresAtMs?: number;
  aliases: Record<string, string>;
}

export interface Item {
  id: ItemId;
  name: string;
  description: string;
  useText: string;
  icon?: string; // Lucide icon name
  /** High-level item category for UI/commands. Defaults to `misc`. */
  itemType?: 'gear' | 'weapon' | 'misc';
  /** For `itemType: "gear"`: UI slot this item equips into. */
  gearSlot?: 'head' | 'torso' | 'hands' | 'legs' | 'feet';
  /** For `itemType: "weapon"`: preferred hand. */
  weaponHand?: 'left' | 'right';
  /** If true, can be worn with the `equip` command while in inventory. */
  equippable?: boolean;
  /** Only one equipped item per slot (e.g. `torso`). Equipping another item in the same slot replaces it. */
  equipmentSlot?: string;
  /** Shown in `examine self` when this item is equipped. */
  wearDescription?: string;
}

/** Use as `reuseInteractionId` to mirror `examine <object>` (state description when set, else `text` / applyInteraction). */
export const REUSE_INTERACTION_EXAMINE = 'examine' as const;

export interface Interaction {
  regex: string;
  /**
   * Shown when this interaction runs via `applyInteraction`. Omitted when using only
   * `reuseInteractionId` (the referenced interaction supplies `text`).
   */
  text?: string;
  /**
   * Authoring-only: stable id unique within this object’s `interactions` array.
   * Referenced by `reuseInteractionId` on sibling entries.
   */
  id?: string;
  /**
   * - Another interaction’s `id` in this object (merged; this entry overrides; `regex` always wins).
   * - The literal `"examine"` (or `REUSE_INTERACTION_EXAMINE`): same behavior as `examine <object>` /
   *   `look at <object>` — show `descriptions[currentState]` when present, otherwise fall through to
   *   `applyInteraction` (e.g. optional `text` on this entry).
   * Chains resolve recursively; cycles throw at runtime.
   */
  reuseInteractionId?: string;
  /**
   * Set by the engine when `reuseInteractionId` is `"examine"`. Do not set in game data.
   */
  examineReuse?: boolean;
  nextScene?: string;
  getItem?: ItemId;
  removeItem?: ItemId;
  /** All listed items must be in inventory before this interaction runs (also, `removeItem` is required implicitly). */
  requiresInventory?: ItemId[];
  /** If set, this interaction is only considered when the object is in this state (object the regex matched on). */
  whenObjectState?: string;
  /** Partial axis match — every key must equal the object’s current axes (see `GameObject.initialAxes`). */
  whenAxes?: Record<string, string>;
  damage?: number;
  isDeath?: boolean;
  /** Sets one axis (see `GameObject.legacyStateKey`, default `s`). Prefer `setAxes` for multiple axes. */
  setState?: string;
  /** Merge into object axis state (e.g. `{ door: 'open', contents: 'empty' }`). */
  setAxes?: Partial<Record<string, string>>;
  /** Shown when setState matches the object’s current state (no-op). */
  redundantMessage?: string;
  /** When requirements are not met (inventory / implicit removeItem). */
  missingRequirementsMessage?: string;
  /** SFX for this interaction (separate from inventory pickup `item` sound). Pass an array to play clips back-to-back. */
  playSound?: GameSfxSpec;
  /** When false, omit from command suggestions (easter egg). */
  autoComplete?: boolean;
  /** Add to score when this interaction resolves successfully. */
  scoreDelta?: number;
  /** After this interaction runs, set a follow-up prompt for the next command. */
  setPrompt?: SetPromptSpec;
  /** Clear any active timed-decision deadline (e.g. after successful escape). */
  clearDeadline?: boolean;
  /** Start a timed decision (wall-clock + turn fallback) when this interaction resolves. */
  setDeadline?: {
    deadlineMsFromNow: number;
    deadlineTurnsLeft: number;
    deadlineSceneId: string;
    deadlineReason: DeadlineReason;
  };
  callback?: (state: GameState) => GameState;
}

export interface GameObject {
  id: ObjectId;
  name: string;
  /** Keys: legacy single-state id (`flat`), composite `serializeObjectAxes` (`contents:key|door:closed`), or sorted `a|b` form. */
  descriptions: Record<string, string>;
  /** Legacy single-axis default when `initialAxes` is omitted. */
  initialState: string;
  /** Multi-axis starting state (e.g. door + contents). When set, overrides `initialState` for storage. */
  initialAxes?: Record<string, string>;
  /** Axis name used by legacy `setState` / `whenObjectState` (default `s`). */
  legacyStateKey?: string;
  interactions: Interaction[];
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  /** Scene-specific HELP copy used by both HELP command and Help modal. */
  helpText?: string;
  /** One-shot effects when this scene is entered for the first time (not from `explore the room` as a command). */
  onLoad?: SceneOnLoad;
  /** Shown for `examine room` / `explore the room` / similar refreshes (distinct from `onLoad` and from bare `look`). */
  examineRefreshText?: string;
  image?: string;
  background?: string;
  /**
   * When set, the cutscene panel image participates in a Motion `layoutId` handoff
   * (e.g. gameplay viewport in App). Target gameplay scenes should use the same id
   * on their viewport image wrapper.
   */
  viewportHandoffLayoutId?: string;
  /** Cutscene chrome: `PANEL_NN` index (e.g. 1 = bedroom intro, 3 = parents bedroom beat). */
  cutscenePanelOrdinal?: number;
  /** Per-choice overline above the main label; defaults to `OPTION_N`. Same order as `Object.keys(commands)`. */
  cutsceneChoiceOverlines?: string[];
  objects: ObjectId[]; // IDs of objects present in this scene
  /** Extra interaction labels for the sidebar (e.g. BED when not a separate object) */
  interactionLabels?: string[];
  exits: Record<string, string>; // direction -> sceneId
  isCheckpoint?: boolean;
  commands?: Record<string, CommandResponse>; // Legacy support or scene-wide commands
}

export interface CommandResponse {
  /** Omitted or empty when only the next scene description should appear (e.g. after intro choice). */
  text?: string;
  nextScene?: string;
  getItem?: ItemId;
  removeItem?: ItemId;
  requiresInventory?: ItemId[];
  missingRequirementsMessage?: string;
  damage?: number;
  isDeath?: boolean;
  scoreDelta?: number;
  setPrompt?: SetPromptSpec;
  clearDeadline?: boolean;
  callback?: (state: GameState) => GameState;
}

export interface GameState {
  playerName: string;
  currentSceneId: string;
  inventory: ItemId[];
  /** Per-object state: legacy string (one axis) or axis map for multi-state objects. */
  objectStates: Record<ObjectId, string | Record<string, string>>;
  hp: number;
  maxHp: number;
  flags: Record<string, boolean | string | number>;
  history: string[];
  lastCheckpoint?: GameState;
  isGameOver: boolean;
  gameStarted: boolean;
  namingPhase: boolean;
  uiVisible: boolean;
  hasMap: boolean;
  pendingItem: ItemId | null;
  /** UI animation queue for newly obtained items. */
  pendingItemQueue?: Array<{ id: ItemId; target: 'inventory' | 'equipment' }>;
  /** Last object the user examined/acted upon (used for viewport highlight). */
  focusedObjectId?: ObjectId;
  /** Items currently worn (subset of inventory); appearance text comes from item `wearDescription`. */
  equippedItemIds: ItemId[];
  /** Cumulative adventure score (movie-game style). */
  score: number;
  /** Follow-up question context (narrow alias resolution). */
  pendingPrompt?: PendingPrompt;
  /** Wall-clock deadline for the current timed decision (ms since epoch). */
  deadlineAtMs?: number;
  /** Scene id the deadline applies to (must match `currentSceneId` to count). */
  deadlineSceneId?: string;
  /** Used to pick death / narrative when time runs out. */
  deadlineReason?: DeadlineReason;
  /** Turn-based fallback: decrements once per command while in `deadlineSceneId`. */
  deadlineTurnsLeft?: number;
}

export const INITIAL_STATE: GameState = {
  playerName: '',
  currentSceneId: 'cutscene_intro',
  inventory: [],
  objectStates: {},
  hp: 100,
  maxHp: 100,
  flags: {},
  history: [],
  isGameOver: false,
  gameStarted: false,
  namingPhase: false,
  uiVisible: false,
  hasMap: false,
  pendingItem: null,
  pendingItemQueue: [],
  focusedObjectId: undefined,
  equippedItemIds: [],
  score: 0,
};

export interface CutsceneChoice {
  text: string;
  nextScene: string;
  flags?: Record<string, any>;
}

export interface Cutscene {
  id: string;
  title: string;
  panels: string[]; // URLs or descriptions for comic panels
  text: string;
  choices: CutsceneChoice[];
}
