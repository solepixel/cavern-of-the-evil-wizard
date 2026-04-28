import { GameState } from '../types';
import { OBJECTS } from '../gameData';
import { DEFAULT_LEGACY_STATE_KEY, getObjectAxes } from './objectState';

const BEDROOM_STATUS_BITS: string[] = [
  'door unlocked',
  'wardrobe door open',
  'wardrobe key taken (contents empty)',
  'rug flipped',
  'rug quarter taken (contents empty)',
  'bed made',
];

const PARENTS_BEDROOM_STATUS_BITS: string[] = [
  'closet contents empty (clothes taken)',
  'closet door open',
  'rattle taken',
  'sister quiet',
];

/**
 * Visible AREA chip + debug: `{CC}X{SCENE_ID}`.
 * `CC` is a stable 2-hex-digit code describing the scene's persisted state.
 */
export function getSceneAreaDisplayLabel(state: GameState, sceneId: string): string {
  return `${getSceneStateCode2(state, sceneId)}X${sceneId.toUpperCase()}`;
}

export interface DecodedSceneAreaLabel {
  raw: string;
  statusHex: string;
  statusByte: number;
  sceneId: string;
  matched: boolean;
  bitStates: Array<{ bit: number; enabled: boolean; label: string }>;
}

export function decodeSceneAreaLabel(rawInput: string): DecodedSceneAreaLabel | null {
  const raw = rawInput.trim().toUpperCase();
  const m = raw.match(/^([0-9A-F]{2})X?([A-Z0-9_]+)?$/);
  if (!m) return null;

  const statusHex = m[1];
  const statusByte = Number.parseInt(statusHex, 16);
  const sceneId = (m[2] ?? '').toLowerCase();
  const bitLabels = getSceneStatusBitLabels(sceneId);
  const bitStates: Array<{ bit: number; enabled: boolean; label: string }> = bitLabels.map((label, bit) => ({
    bit,
    enabled: Boolean(statusByte & (1 << bit)),
    label,
  }));

  return {
    raw,
    statusHex,
    statusByte,
    sceneId,
    matched: Boolean(sceneId),
    bitStates,
  };
}

function getSceneStatusBitLabels(sceneId: string): string[] {
  switch (sceneId) {
    case 'bedroom':
      return BEDROOM_STATUS_BITS;
    case 'parents_bedroom':
      return PARENTS_BEDROOM_STATUS_BITS;
    default:
      return Array.from({ length: 8 }, (_, i) => `unknown bit ${i}`);
  }
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
