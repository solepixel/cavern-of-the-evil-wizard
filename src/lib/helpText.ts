import { Scene } from '../types';

export const DEFAULT_HELP_TEXT =
  "Try commands like 'look', 'examine self', 'equip <item>', 'inventory', 'score', 'go [direction]', 'take [item]', or 'use [item] on [object]'.";

export function getHelpText(scene?: Scene): string {
  return scene?.helpText?.trim() || DEFAULT_HELP_TEXT;
}

