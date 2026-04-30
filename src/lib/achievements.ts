export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  stackable?: boolean;
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  curiosity: {
    id: 'curiosity',
    name: 'Curiosity +1',
    description: 'You investigate optional details and hidden nooks.',
    icon: 'Sparkles',
    stackable: true,
  },
  tidy: {
    id: 'tidy',
    name: 'Tidy +1',
    description: 'You clean up after yourself in a chaotic adventure.',
    icon: 'Square',
    stackable: true,
  },
  self_reflection: {
    id: 'self_reflection',
    name: 'Self Reflection',
    description: 'You pause to examine yourself in the middle of the crisis.',
    icon: 'BookOpen',
    stackable: false,
  },
};

export const ACTION_ACHIEVEMENT_AWARDS: Record<string, { achievementId: string; delta: number }> = {
  'interaction:bed:bed_look_under': { achievementId: 'curiosity', delta: 1 },
  'interaction:window:window_look_out': { achievementId: 'curiosity', delta: 1 },
  'interaction:bed:bed_make': { achievementId: 'tidy', delta: 1 },
  'interaction:rug:rug_fix': { achievementId: 'tidy', delta: 1 },
  'interaction:wardrobe:wardrobe_close': { achievementId: 'tidy', delta: 1 },
  'interaction:parents_closet:parents_closet_close': { achievementId: 'tidy', delta: 1 },
  'builtin:examine_self': { achievementId: 'self_reflection', delta: 1 },
};

export function getAchievementDisplayName(id: string, level: number): string {
  const def = ACHIEVEMENTS[id];
  if (!def) return id.toUpperCase();
  if (def.stackable) return `${def.name} (x${Math.max(1, level)})`;
  return def.name;
}
