import { GameObject, GameState, ObjectId } from '../types';
import { OBJECTS } from '../gameData';

/** Stable key for `descriptions` when using multiple axes (sorted axis names). */
export function serializeObjectAxes(axes: Record<string, string>): string {
  return Object.keys(axes)
    .sort()
    .map((k) => `${k}:${axes[k]}`)
    .join('|');
}

/** Default axis for legacy single-string state (`initialState` / `setState`). */
export const DEFAULT_LEGACY_STATE_KEY = 's';

export function getInitialAxes(obj: GameObject): Record<string, string> {
  if (obj.initialAxes) {
    return { ...obj.initialAxes };
  }
  return { [obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY]: obj.initialState };
}

export function getObjectAxes(state: GameState, objId: ObjectId, obj: GameObject): Record<string, string> {
  const raw = state.objectStates[objId];
  if (raw === undefined) {
    return getInitialAxes(obj);
  }
  if (typeof raw === 'string') {
    return { [obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY]: raw };
  }
  return { ...(raw as Record<string, string>) };
}

/**
 * Prefer composite key, then single-value legacy lookup on `descriptions`.
 */
export function resolveObjectDescription(obj: GameObject, axes: Record<string, string>): string | undefined {
  const composite = serializeObjectAxes(axes);
  if (obj.descriptions[composite]) {
    return obj.descriptions[composite];
  }
  const keys = Object.keys(axes);
  if (keys.length === 1) {
    const v = axes[keys[0]];
    if (v && obj.descriptions[v]) {
      return obj.descriptions[v];
    }
  }
  const legacy = axes[DEFAULT_LEGACY_STATE_KEY];
  if (legacy && obj.descriptions[legacy]) {
    return obj.descriptions[legacy];
  }
  return undefined;
}

export function interactionWhenMatches(
  interaction: { whenObjectState?: string; whenAxes?: Record<string, string> },
  axes: Record<string, string>,
  obj: GameObject,
): boolean {
  if (interaction.whenAxes) {
    for (const [k, v] of Object.entries(interaction.whenAxes)) {
      if ((axes[k] ?? '') !== v) {
        return false;
      }
    }
    return true;
  }
  if (interaction.whenObjectState !== undefined) {
    const key = obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
    return (axes[key] ?? '') === interaction.whenObjectState;
  }
  return true;
}

/** Format object state for debug / sidebar when multi-axis. */
export function formatObjectStateForDisplay(state: GameState, objId: ObjectId, obj: GameObject): string {
  const axes = getObjectAxes(state, objId, obj);
  const keys = Object.keys(axes);
  if (keys.length <= 1) {
    return axes[keys[0] ?? DEFAULT_LEGACY_STATE_KEY] ?? '';
  }
  return serializeObjectAxes(axes);
}
