import { GameState } from '../types';
import { OBJECTS } from '../gameData';
import { DEFAULT_LEGACY_STATE_KEY, getObjectAxes } from './objectState';

/**
 * Visible AREA chip + debug: `{CC}X{SCENE_ID}`.
 * `CC` is a stable 2-hex-digit code describing the scene's persisted state.
 */
export function getSceneAreaDisplayLabel(state: GameState, sceneId: string): string {
  return `${getSceneStateCode2(state, sceneId)}X${sceneId.toUpperCase()}`;
}

function getSceneStateCode2(state: GameState, sceneId: string): string {
  const code = getSceneStateByte(state, sceneId);
  return code.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Pack a scene's persisted state into a single byte (0-255).
 * This should only depend on saved `objectStates` (not transient UI or command history),
 * so the code remains stable and fully restorable.
 */
function getSceneStateByte(state: GameState, sceneId: string): number {
  switch (sceneId) {
    case 'bedroom':
      return bedroomStateByte(state);
    case 'parents_bedroom':
      return parentsBedroomStateByte(state);
    default:
      return 0x00;
  }
}

/**
 * `bedroom` state bits:
 * 0: door unlocked
 * 1: wardrobe door open
 * 2: wardrobe key taken (contents empty)
 * 3: rug flipped
 * 4: rug quarter taken (contents empty)
 * 5: bed made
 */
function bedroomStateByte(state: GameState): number {
  let b = 0x00;
  const door = OBJECTS.door;
  if (door) {
    const ax = getObjectAxes(state, 'door', door);
    const lk = door.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
    if ((ax[lk] ?? door.initialState) === 'unlocked') b |= 1 << 0;
  }
  const wardrobe = OBJECTS.wardrobe;
  if (wardrobe) {
    const ax = getObjectAxes(state, 'wardrobe', wardrobe);
    if (ax.door === 'open') b |= 1 << 1;
    if (ax.contents === 'empty') b |= 1 << 2;
  }
  const rug = OBJECTS.rug;
  if (rug) {
    const ax = getObjectAxes(state, 'rug', rug);
    if (ax.lay === 'flipped') b |= 1 << 3;
    if (ax.contents === 'empty') b |= 1 << 4;
  }
  const bed = OBJECTS.bed;
  if (bed) {
    const ax = getObjectAxes(state, 'bed', bed);
    const lk = bed.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
    if ((ax[lk] ?? bed.initialState) === 'made') b |= 1 << 5;
  }
  return b & 0xff;
}

/**
 * `parents_bedroom` state bits:
 * 0: closet contents empty (clothes taken)
 * 1: closet door open
 * 2: rattle taken
 * 3: sister quiet
 */
function parentsBedroomStateByte(state: GameState): number {
  let b = 0x00;
  const closet = OBJECTS.parents_closet;
  if (closet) {
    const ax = getObjectAxes(state, 'parents_closet', closet);
    if (ax.contents === 'empty') b |= 1 << 0;
    if (ax.door === 'open') b |= 1 << 1;
  }
  const rattleTable = OBJECTS.rattle_table;
  if (rattleTable) {
    const ax = getObjectAxes(state, 'rattle_table', rattleTable);
    const lk = rattleTable.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
    if ((ax[lk] ?? rattleTable.initialState) === 'empty') b |= 1 << 2;
  }
  const playpen = OBJECTS.playpen;
  if (playpen) {
    const ax = getObjectAxes(state, 'playpen', playpen);
    if (ax.sister === 'quiet') b |= 1 << 3;
  }
  return b & 0xff;
}
