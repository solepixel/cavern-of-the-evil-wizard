import { GameState, CommandResponse, Interaction, GameObject } from '../types';
import { SCENES, ITEMS, OBJECTS, INITIAL_STATE } from '../gameData';
import { audioService, saveAudioPreferences } from './audioService';

const SAVE_KEY = 'cavern_evil_wizard_save';
const SAVE_SLOTS_KEY = 'cavern_evil_wizard_save_slots_v1';

export interface SaveSlotSummary {
  id: string;
  savedAt: number; // epoch ms
  sceneId: string;
  playerName: string;
}

interface SaveSlotRecord extends SaveSlotSummary {
  state: GameState;
}

/** Prefix for terminal lines that should render as dim “system” messages in the UI */
export const SYS_PREFIX = '[SYS] ';

export function sysLine(message: string): string {
  return `${SYS_PREFIX}${message}`;
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
      .map(({ id, savedAt, sceneId, playerName }) => ({ id, savedAt, sceneId, playerName }))
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
    return rec.state;
  } catch {
    return null;
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

/** Match "examine X" / "look at X" / "look X" and return the object noun phrase (lowercase, no leading "the"). */
function parseExamineTarget(command: string): string | null {
  const m = command.match(/^(?:examine|look)\s+(?:at\s+)?(.+)$/i);
  if (!m) return null;
  return m[1].trim().toLowerCase().replace(/^the\s+/i, '');
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

export function loadGame(): GameState | null {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure objectStates exists for older saves
      if (!parsed.objectStates) parsed.objectStates = {};
      if (parsed.focusedObjectId === undefined) parsed.focusedObjectId = undefined;
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
          "Try commands like 'look', 'inventory', 'go [direction]', 'take [item]', or 'use [item] on [object]'.",
        ],
      }),
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

  const examineTarget = parseExamineTarget(command);
  if (examineTarget) {
    const objId = resolveObjectInScene(examineTarget, currentScene.objects);
    if (objId) {
      const obj = OBJECTS[objId];
      if (obj) {
        newState.focusedObjectId = objId;
        const st = newState.objectStates[objId] ?? obj.initialState;
        const desc = obj.descriptions[st];
        if (desc) {
          newState.history.push(replaceName(desc));
          return newState;
        }
      }
    }
  }

  // 1. Check Object Interactions in current scene
  for (const objId of currentScene.objects) {
    const obj = OBJECTS[objId];
    if (!obj) continue;

    for (const interaction of obj.interactions) {
      const regex = new RegExp(`^${interaction.regex}$`, 'i');
      if (regex.test(command)) {
        // Found a match!
        newState.focusedObjectId = objId;
        const currentState = newState.objectStates[objId] || obj.initialState;

        // If it's a generic "look" at the object, we might want to use the state-specific description
        if (command.includes('look') || command.includes('examine')) {
          const stateDesc = obj.descriptions[currentState];
          if (stateDesc) {
            newState.history.push(replaceName(stateDesc));
            return newState;
          }
        }

        return applyInteraction(newState, interaction, objId);
      }
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
      const nextScene = SCENES[nextSceneId];
      newState.history.push(replaceName(nextScene.description));
      if (nextScene.isCheckpoint) {
        newState.lastCheckpoint = { ...newState, history: [] }; // Save checkpoint
        saveCheckpoint(newState);
      }
      return newState;
    }
  }

  newState.history.push("Command not recognized.");
  return newState;
}

function applyInteraction(state: GameState, interaction: Interaction, objId?: string): GameState {
  let newState = { ...state };
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);

  if (interaction.setState && objId) {
    const obj = OBJECTS[objId];
    const currentSt = state.objectStates[objId] ?? obj?.initialState ?? '';
    if (currentSt === interaction.setState) {
      const msg = interaction.redundantMessage ?? interaction.text ?? 'Nothing changes.';
      newState.history.push(replaceName(msg));
      return newState;
    }
  }

  if (interaction.setState && objId) {
    newState.objectStates = { ...newState.objectStates, [objId]: interaction.setState };
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
    newState.inventory = newState.inventory.filter(id => id !== interaction.removeItem);
  }

  if (interaction.damage) {
    newState.hp = Math.max(0, newState.hp - interaction.damage);
    if (newState.hp === 0) {
      newState.isGameOver = true;
      newState.history.push("YOU HAVE DIED.");
    }
  }

  if (interaction.isDeath) {
    newState.isGameOver = true;
    newState.hp = 0;
    newState.history.push("YOU HAVE DIED.");
  }

  if (interaction.nextScene) {
    newState.currentSceneId = interaction.nextScene;
    const nextScene = SCENES[interaction.nextScene];
    if (nextScene) {
      const desc = nextScene.description ? replaceName(nextScene.description) : '';
      const resp = interaction.text ? replaceName(interaction.text) : '';
      if (resp && desc) {
        newState.history.push(`${resp}\n\n${desc}`);
      } else if (resp) {
        newState.history.push(resp);
      } else if (desc) {
        newState.history.push(desc);
      }
      if (nextScene.isCheckpoint) {
        newState.lastCheckpoint = { ...newState, history: [] };
        saveCheckpoint(newState);
      }
    } else if (interaction.text) {
      newState.history.push(replaceName(interaction.text));
    }
  } else if (interaction.text) {
    newState.history.push(replaceName(interaction.text));
  }

  if (interaction.callback) {
    newState = interaction.callback(newState);
  }

  return newState;
}

function applyResponse(state: GameState, response: CommandResponse): GameState {
  let newState = { ...state };
  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);

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
    newState.inventory = newState.inventory.filter(id => id !== response.removeItem);
  }

  if (response.damage) {
    newState.hp = Math.max(0, newState.hp - response.damage);
    if (newState.hp === 0) {
      newState.isGameOver = true;
      newState.history.push("YOU HAVE DIED.");
    }
  }

  if (response.isDeath) {
    newState.isGameOver = true;
    newState.hp = 0;
    newState.history.push("YOU HAVE DIED.");
  }

  if (response.nextScene) {
    newState.currentSceneId = response.nextScene;
    const nextScene = SCENES[response.nextScene];
    if (nextScene) {
      const desc = nextScene.description ? replaceName(nextScene.description) : '';
      const resp = response.text ? replaceName(response.text) : '';
      if (resp && desc) {
        newState.history.push(`${resp}\n\n${desc}`);
      } else if (resp) {
        newState.history.push(resp);
      } else if (desc) {
        newState.history.push(desc);
      }
      if (nextScene.isCheckpoint) {
        newState.lastCheckpoint = { ...newState, history: [] };
        saveCheckpoint(newState);
      }
    } else if (response.text) {
      newState.history.push(replaceName(response.text));
    }
  } else if (response.text) {
    newState.history.push(replaceName(response.text));
  }

  if (response.callback) {
    newState = response.callback(newState);
  }

  return newState;
}
