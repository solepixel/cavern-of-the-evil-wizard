import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { ITEMS, OBJECTS, SCENES } from '../gameData';
import { audioService, AVAILABLE_SFX_IDS } from '../lib/audioService';
import { SaveSlotSummary } from '../lib/gameEngine';
import { GameState, ItemId } from '../types';
import { SCORE_PICKUP_ITEM, resolveFirstEnterSceneScore } from '../lib/gameScoring';
import { DEFAULT_LEGACY_STATE_KEY, getObjectAxes } from '../lib/objectState';
import {
  addInventoryItems,
  deleteFlag,
  equipItem,
  jumpToScene,
  removeInventoryItems,
  runDebugCommand,
  setFlagValue,
  setObjectAxis,
  setObjectStateValue,
  setPlayerStateField,
  unequipItem,
} from '../lib/debugActions';
import { decodeSceneAreaLabel, getSceneAreaDisplayLabel } from '../lib/sceneAreaLabel';

type TabId = 'navigation' | 'scenes' | 'inventory' | 'player' | 'flags' | 'objects' | 'commands' | 'audio' | 'saves';

interface DebugPanelModalProps {
  isOpen: boolean;
  state: GameState;
  saveSlots: SaveSlotSummary[];
  onClose: () => void;
  onApplyState: (next: GameState) => void;
  onSaveCheckpoint: () => void;
  onLoadSlot: (slotId: string) => void;
  onDeleteSlot: (slotId: string) => void;
  onOpenDataLog: () => void;
  damageFlashPinned: boolean;
  onTriggerDamageFlash: () => void;
  onToggleDamageFlashPinned: () => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'navigation', label: 'Navigation' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'player', label: 'Player' },
  { id: 'flags', label: 'Flags' },
  { id: 'objects', label: 'Objects' },
  { id: 'commands', label: 'Commands' },
  { id: 'audio', label: 'Audio' },
  { id: 'saves', label: 'Saves' },
];

function parseFlagValue(raw: string): boolean | number | string {
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  const n = Number(raw);
  if (!Number.isNaN(n) && raw.trim() !== '') return n;
  return raw;
}

type SceneGroup = { id: string; label: string; sceneIds: string[] };
type SceneScoreSummary = {
  sceneId: string;
  maxScenePoints: number;
  cumulativeMaxPoints: number;
  breakdown: Array<{ label: string; points: number }>;
};

function overlayMatchesObjectState(
  overlay: NonNullable<(typeof SCENES)[string]['overlays']>[number],
  state: GameState,
): boolean {
  const when = overlay.when;
  if (!when) return false;
  const obj = OBJECTS[when.objectId];
  if (!obj) return false;
  const axes = getObjectAxes(state, when.objectId, obj);
  if (when.whenAxes) {
    for (const [k, v] of Object.entries(when.whenAxes)) {
      if ((axes[k] ?? '') !== v) return false;
    }
  }
  if (when.whenObjectState !== undefined) {
    const key = obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY;
    if ((axes[key] ?? '') !== when.whenObjectState) return false;
  }
  return true;
}

function collectObjectAxisOptions(objectId: string): Record<string, string[]> {
  const obj = OBJECTS[objectId];
  if (!obj) return {};
  const map = new Map<string, Set<string>>();
  const add = (axis: string, value: string | undefined) => {
    if (!axis || value === undefined || value === '') return;
    if (!map.has(axis)) map.set(axis, new Set<string>());
    map.get(axis)!.add(value);
  };
  if (obj.initialAxes) {
    for (const [k, v] of Object.entries(obj.initialAxes)) add(k, v);
  } else {
    add(obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY, obj.initialState);
  }
  for (const it of obj.interactions ?? []) {
    for (const [k, v] of Object.entries(it.whenAxes ?? {})) add(k, v);
    for (const [k, v] of Object.entries(it.setAxes ?? {})) add(k, v);
    if (it.whenObjectState !== undefined) add(obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY, it.whenObjectState);
    if (it.setState !== undefined) add(obj.legacyStateKey ?? DEFAULT_LEGACY_STATE_KEY, it.setState);
  }
  const out: Record<string, string[]> = {};
  for (const [k, vals] of map.entries()) out[k] = Array.from(vals).sort();
  return out;
}

const SCENE_GROUP_PRESET: SceneGroup[] = [
  {
    id: 'house',
    label: 'House Arc',
    sceneIds: [
      'cutscene_intro',
      'bedroom',
      'hallway',
      'bathroom_hall',
      'parents_bedroom',
      'cutscene_house_escape',
      'cutscene_bike_to_fairgrounds',
      'fairgrounds',
      'cutscene_into_movie_game',
    ],
  },
  {
    id: 'ice',
    label: 'Ice Quest Arc',
    sceneIds: [
      'ice_dwarf_village',
      'icy_pass',
      'glacial_armory',
      'ice_cavern_gate',
      'ice_wizard_arena',
      'relic_escape',
      'bandit_pass',
      'ice_dwarf_village_final',
    ],
  },
  {
    id: 'world',
    label: 'Crossroads & Regions',
    sceneIds: ['crossroads', 'water_village', 'fire_village', 'summit_gate'],
  },
  {
    id: 'ending',
    label: 'Ending',
    sceneIds: ['ending_fair_return'],
  },
];

function buildSceneGroups(): SceneGroup[] {
  const allIds = new Set(Object.keys(SCENES));
  const base = SCENE_GROUP_PRESET.map((g) => ({
    ...g,
    sceneIds: g.sceneIds.filter((id) => allIds.has(id)),
  })).filter((g) => g.sceneIds.length > 0);
  for (const g of base) {
    for (const id of g.sceneIds) allIds.delete(id);
  }
  if (allIds.size > 0) {
    base.push({
      id: 'other',
      label: 'Other / Unsorted',
      sceneIds: Array.from(allIds).sort(),
    });
  }
  return base;
}

function buildSceneScoreSummaries(groups: SceneGroup[]): Record<string, SceneScoreSummary> {
  const orderedSceneIds = groups.flatMap((g) => g.sceneIds);
  const out: Record<string, SceneScoreSummary> = {};
  let runningTotal = 0;

  for (const sceneId of orderedSceneIds) {
    const scene = SCENES[sceneId];
    if (!scene) continue;
    const breakdown: Array<{ label: string; points: number }> = [];
    let maxScenePoints = 0;

    const firstEnterScore = resolveFirstEnterSceneScore(scene.firstEnterScore);
    if (firstEnterScore > 0) {
      breakdown.push({ label: 'First-time scene entry bonus', points: firstEnterScore });
      maxScenePoints += firstEnterScore;
    }

    const pickupIds = new Set<string>();
    if (scene.onLoad?.getItem) pickupIds.add(scene.onLoad.getItem);

    for (const objId of scene.objects ?? []) {
      const obj = OBJECTS[objId];
      if (!obj) continue;
      const interactionScoreKeys = new Set<string>();
      for (const it of obj.interactions ?? []) {
        if (typeof it.scoreDelta === 'number' && it.scoreDelta > 0) {
          const scoreKey = it.id ? `${objId}:${it.id}` : `${objId}:${it.regex}`;
          if (!interactionScoreKeys.has(scoreKey)) {
            interactionScoreKeys.add(scoreKey);
            maxScenePoints += it.scoreDelta;
            breakdown.push({
              label: `Object action: ${(obj.name || objId).toUpperCase()} (${it.id ?? it.regex})`,
              points: it.scoreDelta,
            });
          }
        }
        if (it.getItem) pickupIds.add(it.getItem);
      }
    }

    const commandScoreKeys = new Set<string>();
    for (const [commandKey, response] of Object.entries(scene.commands ?? {})) {
      if (typeof response.scoreDelta === 'number' && response.scoreDelta > 0 && !commandScoreKeys.has(commandKey)) {
        commandScoreKeys.add(commandKey);
        maxScenePoints += response.scoreDelta;
        breakdown.push({ label: `Scene command: ${commandKey}`, points: response.scoreDelta });
      }
      if (response.getItem) pickupIds.add(response.getItem);
    }

    if (pickupIds.size > 0) {
      const pickupPoints = pickupIds.size * SCORE_PICKUP_ITEM;
      maxScenePoints += pickupPoints;
      breakdown.push({
        label: `Unique item pickups in scene (${pickupIds.size} x ${SCORE_PICKUP_ITEM})`,
        points: pickupPoints,
      });
    }

    runningTotal += maxScenePoints;
    out[sceneId] = {
      sceneId,
      maxScenePoints,
      cumulativeMaxPoints: runningTotal,
      breakdown,
    };
  }
  return out;
}

export default function DebugPanelModal({
  isOpen,
  state,
  saveSlots,
  onClose,
  onApplyState,
  onSaveCheckpoint,
  onLoadSlot,
  onDeleteSlot,
  onOpenDataLog,
  damageFlashPinned,
  onTriggerDamageFlash,
  onToggleDamageFlashPinned,
}: DebugPanelModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();
  const [activeTab, setActiveTab] = useState<TabId>('navigation');
  const [sceneQuery, setSceneQuery] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState(state.currentSceneId);
  const [navSceneId, setNavSceneId] = useState(state.currentSceneId);
  const [sceneImageModalSrc, setSceneImageModalSrc] = useState<string | null>(null);
  const [areaCodeInput, setAreaCodeInput] = useState(getSceneAreaDisplayLabel(state, state.currentSceneId));
  const [itemQuery, setItemQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<ItemId>('');
  const [flagKey, setFlagKey] = useState('');
  const [flagValue, setFlagValue] = useState('');
  const [objectId, setObjectId] = useState('');
  const [objectStateRaw, setObjectStateRaw] = useState('');
  const [objectAxisKey, setObjectAxisKey] = useState('');
  const [objectAxisValue, setObjectAxisValue] = useState('');
  const [showSceneBackdropInObjectPreview, setShowSceneBackdropInObjectPreview] = useState(true);
  const [debugCommand, setDebugCommand] = useState('');
  const [sfxId, setSfxId] = useState(AVAILABLE_SFX_IDS[0] ?? 'click');
  const [playerName, setPlayerName] = useState(state.playerName);

  const sceneGroups = useMemo(() => buildSceneGroups(), []);
  const orderedSceneIds = useMemo(() => sceneGroups.flatMap((g) => g.sceneIds), [sceneGroups]);
  const sceneScoreById = useMemo(() => buildSceneScoreSummaries(sceneGroups), [sceneGroups]);
  const totalMaxScore = useMemo(
    () => orderedSceneIds.reduce((sum, id) => sum + (sceneScoreById[id]?.maxScenePoints ?? 0), 0),
    [orderedSceneIds, sceneScoreById],
  );
  const filteredSceneGroups = useMemo(() => {
    const q = sceneQuery.trim().toLowerCase();
    if (!q) return sceneGroups;
    return sceneGroups
      .map((g) => ({
        ...g,
        sceneIds: g.sceneIds.filter((id) => {
          const s = SCENES[id];
          return id.toLowerCase().includes(q) || (s?.title ?? '').toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.sceneIds.length > 0);
  }, [sceneGroups, sceneQuery]);
  const itemIds = useMemo(
    () =>
      Object.keys(ITEMS)
        .filter((id) => {
          if (!itemQuery.trim()) return true;
          return id.toLowerCase().includes(itemQuery.toLowerCase()) || ITEMS[id].name.toLowerCase().includes(itemQuery.toLowerCase());
        })
        .sort(),
    [itemQuery],
  );
  const objectIds = useMemo(() => Object.keys(OBJECTS).sort(), []);
  const currentObjectState = objectId ? state.objectStates[objectId] : undefined;
  const selectedObject = objectId ? OBJECTS[objectId] : undefined;
  const selectedObjectAxes = useMemo(() => {
    if (!objectId || !selectedObject) return null;
    return getObjectAxes(state, objectId, selectedObject);
  }, [objectId, selectedObject, state]);
  const objectAxisOptions = useMemo(() => (objectId ? collectObjectAxisOptions(objectId) : {}), [objectId]);
  const decodedAreaCode = useMemo(() => decodeSceneAreaLabel(areaCodeInput), [areaCodeInput]);
  const selectedScene = SCENES[selectedSceneId];
  const selectedSceneScore = sceneScoreById[selectedSceneId];
  const selectedSceneImageSrc = selectedScene?.image ?? selectedScene?.background ?? null;
  const currentScene = SCENES[state.currentSceneId];
  const objectMatchedOverlays = useMemo(() => {
    if (!objectId || !currentScene?.overlays?.length) return [];
    return currentScene.overlays.filter((overlay) => {
      if (overlay.when?.objectId !== objectId) return false;
      return overlayMatchesObjectState(overlay, state);
    });
  }, [objectId, currentScene, state]);
  const currentSceneImageSrc = currentScene?.image ?? currentScene?.background ?? null;

  const apply = (next: GameState) => onApplyState(next);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-220 flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 my-2 flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden border-4 border-accent-cyan bg-bg-panel sm:my-0"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-base p-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-accent-magenta">DEBUG CONTROL PANEL</h2>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-accent-cyan/75">God mode controls for rapid testing</p>
              </div>
              <button type="button" onMouseEnter={hoverUi} onClick={onClose} className="text-accent-cyan hover:text-white" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside className="w-full shrink-0 border-b border-border-base p-3 md:w-52 md:border-b-0 md:border-r">
                <div className="flex flex-wrap gap-2 md:flex-col">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                        activeTab === tab.id
                          ? 'border-accent-cyan bg-accent-cyan text-bg-base'
                          : 'border-border-base text-accent-cyan hover:border-accent-cyan/60 hover:bg-bg-base'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 flex-1 overflow-y-auto p-4">
                {activeTab === 'navigation' && (
                  <section className="space-y-3">
                    <div className="rounded border border-border-base bg-bg-base p-3">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">Quick Jump</div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={navSceneId}
                          onChange={(e) => setNavSceneId(e.target.value)}
                          className="min-w-72 border border-border-base bg-bg-panel px-3 py-2 text-sm text-text-primary"
                        >
                          {orderedSceneIds.map((id) => (
                            <option key={id} value={id}>
                              {id} - {SCENES[id]?.title ?? '(unknown)'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => navSceneId && apply(jumpToScene(state, navSceneId))}
                          className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                        >
                          Jump To Scene
                        </button>
                        <button
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => {
                            setNavSceneId(state.currentSceneId);
                            setSelectedSceneId(state.currentSceneId);
                          }}
                          className="border border-border-base px-3 py-2 text-xs font-black uppercase tracking-widest text-text-primary/80 hover:border-accent-cyan/50"
                        >
                          Use Current
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded border border-border-base bg-bg-base p-3">
                      <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">Scene Status Code Decoder</h4>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={areaCodeInput}
                          onChange={(e) => setAreaCodeInput(e.target.value)}
                          placeholder="e.g. 1AXBEDROOM"
                          className="min-w-56 border border-border-base bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent-cyan focus:outline-none"
                        />
                        <button
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => setAreaCodeInput(getSceneAreaDisplayLabel(state, state.currentSceneId))}
                          className="border border-accent-cyan/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan/15"
                        >
                          Use Current AREA
                        </button>
                      </div>
                      {!decodedAreaCode ? (
                        <div className="mt-2 text-xs text-red-400">
                          Invalid format. Use <code>CCXSCENE_ID</code> or <code>CCSCENE_ID</code> with two hex chars for CC.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs text-text-primary/85">
                          <div>
                            Status: <span className="font-mono text-accent-cyan">{decodedAreaCode.statusHex}</span> (byte {decodedAreaCode.statusByte})
                          </div>
                          <div>
                            Scene: <span className="font-mono">{decodedAreaCode.sceneId || '(none provided)'}</span>
                          </div>
                          <div className="mt-2 grid gap-1 sm:grid-cols-2">
                            {decodedAreaCode.bitStates.map((entry) => (
                              <div key={entry.bit} className="font-mono">
                                bit {entry.bit}: {entry.enabled ? '1' : '0'} - {entry.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'scenes' && (
                  <section className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="min-h-0 space-y-3">
                      <div className="rounded border border-border-base bg-bg-base p-3">
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">Scene Browser</div>
                        <input
                          type="text"
                          placeholder="Filter scene id or title..."
                          value={sceneQuery}
                          onChange={(e) => setSceneQuery(e.target.value)}
                          className="w-full border border-border-base bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent-cyan focus:outline-none"
                        />
                        <div className="mt-2 text-xs text-text-primary/70">
                          Max total score (all scene-max points): <span className="font-black text-accent-cyan">{totalMaxScore}</span>
                        </div>
                      </div>

                      <div className="max-h-[52dvh] space-y-3 overflow-auto pr-1">
                        {filteredSceneGroups.map((group) => (
                          <div key={group.id} className="rounded border border-border-base bg-bg-base p-2">
                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan/80">{group.label}</div>
                            <div className="space-y-1">
                              {group.sceneIds.map((id) => {
                                const meta = sceneScoreById[id];
                                const isSelected = id === selectedSceneId;
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onMouseEnter={hoverUi}
                                    onClick={() => setSelectedSceneId(id)}
                                    className={`w-full border px-3 py-2 text-left text-xs ${
                                      isSelected
                                        ? 'border-accent-cyan bg-bg-panel text-accent-cyan'
                                        : 'border-border-base text-text-primary/85 hover:border-accent-cyan/55 hover:bg-bg-panel'
                                    }`}
                                  >
                                    <div className="font-black uppercase tracking-wide">{id}</div>
                                    <div className="text-[10px] text-text-primary/65">{SCENES[id]?.title}</div>
                                    <div className="mt-1 text-[10px] text-accent-magenta/90">
                                      Scene max: {meta?.maxScenePoints ?? 0} | Total by here: {meta?.cumulativeMaxPoints ?? 0}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <aside className="min-h-0 rounded border border-border-base bg-bg-base p-3">
                      {selectedScene ? (
                        <div className="flex h-full min-h-72 flex-col">
                          <div className="text-[10px] font-black uppercase tracking-widest text-accent-magenta">Scene Details</div>
                          <div className="mt-2 text-sm font-black uppercase text-accent-cyan">{selectedScene.id}</div>
                          <div className="text-xs text-text-primary/75">{selectedScene.title}</div>
                          <div className="mt-2 text-xs text-text-primary/80">
                            Objects: {selectedScene.objects?.length ?? 0} | Exits: {Object.keys(selectedScene.exits ?? {}).length}
                          </div>
                          <div className="mt-2 rounded border border-border-base bg-bg-panel p-2 text-xs">
                            <div>
                              Max points (scene):{' '}
                              <span className="font-black text-accent-cyan">{selectedSceneScore?.maxScenePoints ?? 0}</span>
                            </div>
                            <div>
                              Max total by this scene:{' '}
                              <span className="font-black text-accent-cyan">{selectedSceneScore?.cumulativeMaxPoints ?? 0}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-text-primary/65">Scene Image</div>
                          {selectedSceneImageSrc ? (
                            <button
                              type="button"
                              onMouseEnter={hoverUi}
                              onClick={() => setSceneImageModalSrc(selectedSceneImageSrc)}
                              className="overflow-hidden rounded border border-border-base bg-black text-left hover:border-accent-cyan/60"
                            >
                              <img
                                src={selectedSceneImageSrc}
                                alt={selectedScene.title}
                                className="max-h-44 w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ) : (
                            <div className="rounded border border-border-base bg-bg-panel p-2 text-xs text-text-primary/65">
                              No scene image set.
                            </div>
                          )}
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-text-primary/65">Description</div>
                          <div className="max-h-36 overflow-auto border border-border-base bg-bg-panel p-2 text-xs text-text-primary/80">
                            {selectedScene.description}
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-text-primary/65">Score Breakdown</div>
                          <div className="max-h-44 flex-1 overflow-auto border border-border-base bg-bg-panel p-2 text-xs text-text-primary/85">
                            {(selectedSceneScore?.breakdown ?? []).map((row) => (
                              <div key={`${row.label}:${row.points}`} className="py-0.5">
                                +{row.points} - {row.label}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onMouseEnter={hoverUi}
                            onClick={() => apply(jumpToScene(state, selectedScene.id))}
                            className="mt-3 border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                          >
                            Navigate To Scene
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-text-primary/65">Select a scene to inspect details.</div>
                      )}
                    </aside>
                  </section>
                )}

                {activeTab === 'inventory' && (
                  <section className="space-y-4">
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      className="w-full border border-border-base bg-bg-base px-3 py-2 text-sm text-text-primary focus:border-accent-cyan focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="min-w-64 border border-border-base bg-bg-base px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Select item...</option>
                        {itemIds.map((id) => (
                          <option key={id} value={id}>
                            {id} - {ITEMS[id].name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => selectedItemId && apply(addInventoryItems(state, [selectedItemId]))}
                        className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                      >
                        Add Item
                      </button>
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => selectedItemId && apply(removeInventoryItems(state, [selectedItemId]))}
                        className="border border-red-500 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20"
                      >
                        Remove Item
                      </button>
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => selectedItemId && apply(equipItem(state, selectedItemId))}
                        className="border border-accent-magenta px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-magenta hover:bg-accent-magenta/20"
                      >
                        Equip
                      </button>
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => selectedItemId && apply(unequipItem(state, selectedItemId))}
                        className="border border-border-base px-3 py-2 text-xs font-black uppercase tracking-widest text-text-primary/75 hover:border-accent-cyan/50"
                      >
                        Unequip
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan/75">Inventory</h4>
                        <ul className="space-y-1 text-xs text-text-primary/85">
                          {state.inventory.length ? state.inventory.map((id) => <li key={id}>{id}</li>) : <li>(empty)</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan/75">Equipped</h4>
                        <ul className="space-y-1 text-xs text-text-primary/85">
                          {(state.equippedItemIds ?? []).length ? (state.equippedItemIds ?? []).map((id) => <li key={id}>{id}</li>) : <li>(none)</li>}
                        </ul>
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === 'player' && (
                  <section className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-text-primary/85">
                        Name
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          className="mt-1 w-full border border-border-base bg-bg-base px-2 py-1.5 text-text-primary"
                        />
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <NumberField label="HP" value={state.hp} onApply={(v) => apply(setPlayerStateField(state, { hp: v }))} />
                        <NumberField
                          label="Max HP"
                          value={state.maxHp}
                          onApply={(v) => apply(setPlayerStateField(state, { maxHp: Math.max(1, v) }))}
                        />
                        <NumberField label="Score" value={state.score ?? 0} onApply={(v) => apply(setPlayerStateField(state, { score: Math.max(0, v) }))} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onMouseEnter={hoverUi} onClick={() => apply(setPlayerStateField(state, { playerName: playerName || state.playerName }))} className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base">Apply Name</button>
                      <ToggleButton label="UI Visible" enabled={state.uiVisible} onClick={() => apply(setPlayerStateField(state, { uiVisible: !state.uiVisible }))} />
                      <ToggleButton label="Has Map" enabled={state.hasMap} onClick={() => apply(setPlayerStateField(state, { hasMap: !state.hasMap }))} />
                      <ToggleButton label="Game Started" enabled={state.gameStarted} onClick={() => apply(setPlayerStateField(state, { gameStarted: !state.gameStarted }))} />
                      <ToggleButton label="Naming Phase" enabled={state.namingPhase} onClick={() => apply(setPlayerStateField(state, { namingPhase: !state.namingPhase }))} />
                      <ToggleButton label="Game Over" enabled={state.isGameOver} onClick={() => apply(setPlayerStateField(state, { isGameOver: !state.isGameOver }))} />
                    </div>
                    <div className="rounded border border-border-base bg-bg-base p-3">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">Damage FX Preview</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={onTriggerDamageFlash}
                          className="border border-red-500 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-300 hover:bg-red-500/15"
                        >
                          Trigger Pulse
                        </button>
                        <ToggleButton
                          label="Pin Red Glow"
                          enabled={damageFlashPinned}
                          onClick={onToggleDamageFlashPinned}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === 'flags' && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <input type="text" placeholder="flag key" value={flagKey} onChange={(e) => setFlagKey(e.target.value)} className="min-w-44 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <input type="text" placeholder="value (true/false/number/text)" value={flagValue} onChange={(e) => setFlagValue(e.target.value)} className="min-w-64 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <button type="button" onMouseEnter={hoverUi} onClick={() => flagKey.trim() && apply(setFlagValue(state, flagKey, parseFlagValue(flagValue)))} className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base">Set Flag</button>
                      <button type="button" onMouseEnter={hoverUi} onClick={() => flagKey.trim() && apply(deleteFlag(state, flagKey.trim()))} className="border border-red-500 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20">Delete Flag</button>
                    </div>
                    <div className="max-h-80 overflow-auto border border-border-base bg-bg-base p-2 font-mono text-xs text-text-primary/85">
                      {Object.keys(state.flags).length ? (
                        Object.entries(state.flags).map(([k, v]) => (
                          <div key={k} className="py-0.5">
                            {k}: {String(v)}
                          </div>
                        ))
                      ) : (
                        <div>(no flags)</div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'objects' && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <select value={objectId} onChange={(e) => setObjectId(e.target.value)} className="min-w-56 border border-border-base bg-bg-base px-3 py-2 text-sm">
                        <option value="">Select object...</option>
                        {objectIds.map((id) => (
                          <option key={id} value={id}>
                            {id} - {OBJECTS[id].name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded border border-border-base bg-bg-base p-3 text-xs text-text-primary/80">
                      Current state: {objectId ? JSON.stringify(currentObjectState ?? '(unset)') : '(select object)'}
                    </div>
                    {objectId && selectedObjectAxes && (
                      <div className="rounded border border-border-base bg-bg-base p-3">
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">Quick Axis Controls</div>
                        <div className="space-y-2">
                          {Object.entries(selectedObjectAxes).map(([axisKey, axisValue]) => {
                            const options = objectAxisOptions[axisKey] ?? [];
                            return (
                              <div key={axisKey} className="rounded border border-border-base bg-bg-panel p-2">
                                <div className="mb-1 text-[10px] uppercase tracking-widest text-text-primary/70">
                                  {axisKey}: <span className="font-black text-accent-cyan">{axisValue}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {options.map((value) => (
                                    <button
                                      key={`${axisKey}:${value}`}
                                      type="button"
                                      onMouseEnter={hoverUi}
                                      onClick={() => apply(setObjectAxis(state, objectId, axisKey, value))}
                                      className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                                        value === axisValue
                                          ? 'border-accent-cyan bg-accent-cyan text-bg-base'
                                          : 'border-border-base text-accent-cyan hover:border-accent-cyan/65 hover:bg-bg-base'
                                      }`}
                                    >
                                      {value}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input type="text" placeholder='advanced full state (e.g. {"door":"open","contents":"empty"})' value={objectStateRaw} onChange={(e) => setObjectStateRaw(e.target.value)} className="min-w-64 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          if (!objectId) return;
                          const trimmed = objectStateRaw.trim();
                          if (!trimmed) return;
                          if (trimmed.startsWith('{')) {
                            try {
                              const parsed = JSON.parse(trimmed) as Record<string, string>;
                              apply(setObjectStateValue(state, objectId, parsed));
                            } catch {
                              alert('Invalid JSON for object state.');
                            }
                          } else {
                            apply(setObjectStateValue(state, objectId, trimmed));
                          }
                        }}
                        className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                      >
                        Apply Advanced State
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input type="text" placeholder="axis key" value={objectAxisKey} onChange={(e) => setObjectAxisKey(e.target.value)} className="min-w-44 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <input type="text" placeholder="axis value" value={objectAxisValue} onChange={(e) => setObjectAxisValue(e.target.value)} className="min-w-44 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <button type="button" onMouseEnter={hoverUi} onClick={() => objectId && apply(setObjectAxis(state, objectId, objectAxisKey, objectAxisValue))} className="border border-accent-magenta px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-magenta hover:bg-accent-magenta/15">Set Axis</button>
                    </div>
                    <div className="rounded border border-border-base bg-bg-base p-3">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta">State Image Preview</div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-text-primary/80">
                        <input
                          type="checkbox"
                          checked={showSceneBackdropInObjectPreview}
                          onChange={(e) => setShowSceneBackdropInObjectPreview(e.target.checked)}
                        />
                        Show current scene image as background
                      </label>
                      <div className="relative aspect-video w-full overflow-hidden rounded border border-border-base bg-black">
                        {showSceneBackdropInObjectPreview && currentSceneImageSrc && (
                          <img
                            src={currentSceneImageSrc}
                            alt={currentScene?.title ?? 'Scene background'}
                            className="absolute inset-0 h-full w-full object-cover opacity-70"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {objectMatchedOverlays.map((overlay, idx) => (
                          <img
                            key={`${overlay.src}:${idx}:${overlay.x ?? 0}:${overlay.y ?? 0}:${overlay.xPercent ?? 0}:${overlay.yPercent ?? 0}`}
                            src={overlay.src}
                            alt={objectId ? `${objectId} state` : 'Object state'}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                              transform: `translate(calc(${overlay.xPercent ?? 0}% + ${overlay.x ?? 0}px), calc(${overlay.yPercent ?? 0}% + ${overlay.y ?? 0}px))`,
                            }}
                            referrerPolicy="no-referrer"
                          />
                        ))}
                        {!objectMatchedOverlays.length && (
                          <div className="absolute inset-0 grid place-items-center text-center text-xs text-text-primary/70">
                            {objectId
                              ? 'No matching state image for this object in the current scene.'
                              : 'Select an object to preview its state image.'}
                          </div>
                        )}
                      </div>
                      {objectMatchedOverlays.length > 0 && (
                        <div className="mt-2 text-[10px] text-accent-cyan/75">
                          Matching overlays: {objectMatchedOverlays.length}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'commands' && (
                  <section className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={debugCommand}
                        onChange={(e) => setDebugCommand(e.target.value)}
                        placeholder="Type command to run..."
                        className="flex-1 border border-border-base bg-bg-base px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          apply(runDebugCommand(state, debugCommand));
                          setDebugCommand('');
                        }}
                        className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                      >
                        Run
                      </button>
                    </div>
                    <div className="max-h-80 overflow-auto border border-border-base bg-bg-base p-2 text-xs text-text-primary/85">
                      {(state.history.slice(-12) || []).map((line, i) => (
                        <div key={`${i}-${line.slice(0, 20)}`} className="py-0.5">
                          {line}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTab === 'audio' && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <select value={sfxId} onChange={(e) => setSfxId(e.target.value)} className="min-w-52 border border-border-base bg-bg-base px-3 py-2 text-sm">
                        {AVAILABLE_SFX_IDS.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                      <button type="button" onMouseEnter={hoverUi} onClick={() => audioService.playSound(sfxId)} className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base">Play SFX</button>
                      <button type="button" onMouseEnter={hoverUi} onClick={() => audioService.playAmbient()} className="border border-accent-magenta px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-magenta hover:bg-accent-magenta/15">Play BGM</button>
                      <button type="button" onMouseEnter={hoverUi} onClick={() => audioService.stopAmbient()} className="border border-border-base px-3 py-2 text-xs font-black uppercase tracking-widest text-text-primary/80 hover:border-accent-cyan/50">Stop BGM</button>
                    </div>
                    <pre className="max-h-80 overflow-auto border border-border-base bg-bg-base p-3 text-[11px] text-text-primary/80">
                      {JSON.stringify(audioService.getDebugAudioSnapshot(), null, 2)}
                    </pre>
                    <button type="button" onMouseEnter={hoverUi} onClick={onOpenDataLog} className="border border-accent-cyan/60 px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan/15">
                      Open Data Log Snapshot Modal
                    </button>
                  </section>
                )}

                {activeTab === 'saves' && (
                  <section className="space-y-3">
                    <button type="button" onMouseEnter={hoverUi} onClick={onSaveCheckpoint} className="border border-accent-cyan px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base">
                      Create Debug Checkpoint
                    </button>
                    <div className="space-y-2">
                      {saveSlots.length === 0 ? (
                        <div className="text-xs text-text-primary/60">No save slots.</div>
                      ) : (
                        saveSlots.slice(0, 15).map((slot) => (
                          <div key={slot.id} className="flex flex-wrap items-center justify-between gap-2 border border-border-base bg-bg-base p-2 text-xs">
                            <div>
                              <div className="font-black text-accent-cyan">{slot.playerName || 'PLAYER'} - {slot.sceneId}</div>
                              <div className="text-text-primary/65">{new Date(slot.savedAt).toLocaleString()}</div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onMouseEnter={hoverUi} onClick={() => onLoadSlot(slot.id)} className="border border-accent-cyan px-2 py-1 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base">Load</button>
                              <button type="button" onMouseEnter={hoverUi} onClick={() => onDeleteSlot(slot.id)} className="border border-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20">Delete</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )}
              </main>
            </div>

            <AnimatePresence>
              {sceneImageModalSrc && (
                <div className="fixed inset-0 z-230 flex items-center justify-center p-3 sm:p-6">
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSceneImageModalSrc(null)}
                    className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                    aria-label="Close scene image preview"
                  />
                  <motion.div
                    initial={{ scale: 0.96, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.98, opacity: 0, y: 6 }}
                    className="relative z-10 max-h-[88dvh] w-full max-w-5xl overflow-hidden rounded border-2 border-accent-cyan bg-bg-base"
                  >
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => setSceneImageModalSrc(null)}
                      className="absolute right-2 top-2 z-10 rounded border border-accent-cyan/70 bg-bg-base/85 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
                    >
                      Close
                    </button>
                    <img
                      src={sceneImageModalSrc}
                      alt="Scene preview"
                      className="h-auto max-h-[88dvh] w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function NumberField({
  label,
  value,
  onApply,
}: {
  label: string;
  value: number;
  onApply: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="text-xs text-text-primary/85">
      {label}
      <div className="mt-1 flex gap-1">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full border border-border-base bg-bg-base px-2 py-1 text-text-primary" />
        <button
          type="button"
          onClick={() => {
            const parsed = Number(draft);
            if (Number.isNaN(parsed)) return;
            onApply(parsed);
          }}
          className="border border-accent-cyan px-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-bg-base"
        >
          Set
        </button>
      </div>
    </label>
  );
}

function ToggleButton({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-2 text-xs font-black uppercase tracking-widest ${
        enabled
          ? 'border-accent-cyan bg-accent-cyan text-bg-base'
          : 'border-border-base text-accent-cyan hover:border-accent-cyan/60 hover:bg-bg-base'
      }`}
    >
      {label}
    </button>
  );
}

