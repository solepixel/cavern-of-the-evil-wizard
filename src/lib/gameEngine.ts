import { GameState, CommandResponse, Interaction, GameObject } from '../types';
import { SCENES, ITEMS, OBJECTS, INITIAL_STATE } from '../gameData';
import { audioService } from './audioService';

const SAVE_KEY = 'cavern_evil_wizard_save';

/** Prefix for terminal lines that should render as dim “system” messages in the UI */
export const SYS_PREFIX = '[SYS] ';

export function sysLine(message: string): string {
  return `${SYS_PREFIX}${message}`;
}

export function saveGame(state: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure objectStates exists for older saves
      if (!parsed.objectStates) parsed.objectStates = {};
      return parsed;
    } catch (e) {
      console.error('Failed to load game', e);
    }
  }
  return null;
}

export function processCommand(state: GameState, input: string): GameState {
  const command = input.toLowerCase().trim();
  const currentScene = SCENES[state.currentSceneId];
  
  let newState = { ...state, history: [...state.history, `> ${input}`] };

  const replaceName = (text: string) => text.replace(/{{name}}/g, state.playerName);

  // Check for built-in commands
  if (command === 'inventory' || command === 'i' || command === 'view inventory') {
    const invItems = state.inventory.map(id => ITEMS[id].name).join(', ');
    newState.history.push(sysLine(`Inventory: ${invItems || 'Empty'}`));
    return newState;
  }

  if (command === 'map' || command === 'm' || command === 'view map') {
    newState.history.push("You don't have a map yet, but you remember the layout of your house.");
    return newState;
  }

  if (command.includes('volume up') || command.includes('increase volume')) {
    const newVol = audioService.adjustVolume(0.1);
    newState.history.push(sysLine(`System volume increased to ${Math.round(newVol * 100)}%.`));
    return newState;
  }

  if (command.includes('volume down') || command.includes('reduce volume') || command.includes('bg volume down')) {
    const newVol = audioService.adjustVolume(-0.1);
    newState.history.push(sysLine(`System volume reduced to ${Math.round(newVol * 100)}%.`));
    return newState;
  }

  if (command === 'mute') {
    audioService.toggleMute();
    newState.history.push(sysLine('Audio muted.'));
    return newState;
  }

  if (command === 'unmute') {
    audioService.toggleMute();
    newState.history.push(sysLine('Audio unmuted.'));
    return newState;
  }

  if (command === 'look' || command === 'l') {
    newState.history.push(replaceName(currentScene.description));
    return newState;
  }

  if (command === 'help' || command === 'h') {
    newState.history.push("Try commands like 'look', 'inventory', 'go [direction]', 'take [item]', or 'use [item] on [object]'.");
    return newState;
  }

  // 1. Check Object Interactions in current scene
  for (const objId of currentScene.objects) {
    const obj = OBJECTS[objId];
    if (!obj) continue;

    for (const interaction of obj.interactions) {
      const regex = new RegExp(`^${interaction.regex}$`, 'i');
      if (regex.test(command)) {
        // Found a match!
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
        saveGame(newState);
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
        saveGame(newState);
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
        saveGame(newState);
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
