/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemId = string;
export type ObjectId = string;

export interface Item {
  id: ItemId;
  name: string;
  description: string;
  useText: string;
  icon?: string; // Lucide icon name
}

export interface Interaction {
  regex: string;
  text: string;
  nextScene?: string;
  getItem?: ItemId;
  removeItem?: ItemId;
  damage?: number;
  isDeath?: boolean;
  setState?: string; // Change the state of the object
  callback?: (state: GameState) => GameState;
}

export interface GameObject {
  id: ObjectId;
  name: string;
  descriptions: Record<string, string>; // state -> description
  initialState: string;
  interactions: Interaction[];
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  image?: string;
  background?: string;
  objects: ObjectId[]; // IDs of objects present in this scene
  /** Extra interaction labels for the sidebar (e.g. BED when not a separate object) */
  interactionLabels?: string[];
  exits: Record<string, string>; // direction -> sceneId
  isCheckpoint?: boolean;
  commands?: Record<string, CommandResponse>; // Legacy support or scene-wide commands
}

export interface CommandResponse {
  text: string;
  nextScene?: string;
  getItem?: ItemId;
  removeItem?: ItemId;
  damage?: number;
  isDeath?: boolean;
  callback?: (state: GameState) => GameState;
}

export interface GameState {
  playerName: string;
  currentSceneId: string;
  inventory: ItemId[];
  objectStates: Record<ObjectId, string>; // Track current state of each object
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
  pendingItem: null
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
