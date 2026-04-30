/** Points for acquiring a new inventory item (engine-applied, implicit). */
export const SCORE_PICKUP_ITEM = 15;

/** One-time points the first time you enter a scene from another (implicit). */
export const SCORE_FIRST_ENTER_SCENE = 12;

/** Resolve per-scene first-enter score with global default and floor at zero. */
export function resolveFirstEnterSceneScore(sceneFirstEnterScore: number | undefined): number {
  if (sceneFirstEnterScore === undefined || Number.isNaN(sceneFirstEnterScore)) {
    return SCORE_FIRST_ENTER_SCENE;
  }
  return Math.max(0, sceneFirstEnterScore);
}
