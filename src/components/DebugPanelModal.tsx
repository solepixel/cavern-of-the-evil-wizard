import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { ITEMS, OBJECTS, SCENES } from '../gameData';
import { audioService, AVAILABLE_SFX_IDS } from '../lib/audioService';
import { SaveSlotSummary } from '../lib/gameEngine';
import { GameState, ItemId } from '../types';
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

type TabId = 'navigation' | 'inventory' | 'player' | 'flags' | 'objects' | 'commands' | 'audio' | 'saves';

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
  const [areaCodeInput, setAreaCodeInput] = useState(getSceneAreaDisplayLabel(state, state.currentSceneId));
  const [itemQuery, setItemQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<ItemId>('');
  const [flagKey, setFlagKey] = useState('');
  const [flagValue, setFlagValue] = useState('');
  const [objectId, setObjectId] = useState('');
  const [objectStateRaw, setObjectStateRaw] = useState('');
  const [objectAxisKey, setObjectAxisKey] = useState('');
  const [objectAxisValue, setObjectAxisValue] = useState('');
  const [debugCommand, setDebugCommand] = useState('');
  const [sfxId, setSfxId] = useState(AVAILABLE_SFX_IDS[0] ?? 'click');
  const [playerName, setPlayerName] = useState(state.playerName);

  const sceneIds = useMemo(
    () =>
      Object.keys(SCENES)
        .filter((id) => id.toLowerCase().includes(sceneQuery.toLowerCase()))
        .sort(),
    [sceneQuery],
  );
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
  const decodedAreaCode = useMemo(() => decodeSceneAreaLabel(areaCodeInput), [areaCodeInput]);

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
                    <input
                      type="text"
                      placeholder="Filter scenes..."
                      value={sceneQuery}
                      onChange={(e) => setSceneQuery(e.target.value)}
                      className="w-full border border-border-base bg-bg-base px-3 py-2 text-sm text-text-primary focus:border-accent-cyan focus:outline-none"
                    />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {sceneIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => apply(jumpToScene(state, id))}
                          className="border border-accent-cyan/30 bg-bg-base px-3 py-2 text-left text-xs uppercase tracking-wide text-accent-cyan hover:border-accent-cyan hover:bg-bg-muted"
                        >
                          <div className="font-black">{id}</div>
                          <div className="text-[10px] text-text-primary/65">{SCENES[id].title}</div>
                        </button>
                      ))}
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
                    <div className="flex flex-wrap gap-2">
                      <input type="text" placeholder='set full state (e.g. "open")' value={objectStateRaw} onChange={(e) => setObjectStateRaw(e.target.value)} className="min-w-64 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
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
                        Apply Full State
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input type="text" placeholder="axis key" value={objectAxisKey} onChange={(e) => setObjectAxisKey(e.target.value)} className="min-w-44 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <input type="text" placeholder="axis value" value={objectAxisValue} onChange={(e) => setObjectAxisValue(e.target.value)} className="min-w-44 border border-border-base bg-bg-base px-2 py-1.5 text-sm" />
                      <button type="button" onMouseEnter={hoverUi} onClick={() => objectId && apply(setObjectAxis(state, objectId, objectAxisKey, objectAxisValue))} className="border border-accent-magenta px-3 py-2 text-xs font-black uppercase tracking-widest text-accent-magenta hover:bg-accent-magenta/15">Set Axis</button>
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

