/**
 * Shared timings for cutscene → gameplay handoffs and future decision-point scenes.
 * Keep `HANDOFF_DELAY_MS` in sync with the longest visible motion in `Cutscene.tsx`.
 */
export const CUTSCENE_HANDOFF_DELAY_MS = 2200;

export const cutsceneEase = {
  /** Image de-blur / panel settle */
  image: [0.33, 1, 0.68, 1] as const,
  /** Copy and chrome fades */
  copy: [0.4, 0, 0.2, 1] as const,
};

export const cutsceneImageMotion = {
  blurIdlePx: 22,
  blurClearSec: 1.05,
  scaleIdle: 1.06,
};
