/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import clsx from 'clsx';
import {
  Heart,
  Backpack,
  Map as MapIcon,
  Save,
  Settings as CogIcon,
  Play,
  AlertTriangle,
  Volume2,
  VolumeX,
  Volume1,
  CornerDownLeft,
  PackageOpen,
  Menu,
  X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { GameState, Scene } from './types';
import { INITIAL_STATE, SCENES, ITEMS, OBJECTS } from './gameData';
import {
  processCommand,
  loadGame,
  loadSaveSlot,
  deleteSaveSlot,
  listSaveSlots,
  updateSaveSlotNote,
  resumeFromCheckpointWithFeedback,
  saveCheckpoint,
  saveGame,
  FATAL_PREFIX,
  SYS_PREFIX,
  sysLine,
  applyDeadlineExpired,
} from './lib/gameEngine';
import NamingScreen from './components/NamingScreen';
import Cutscene from './components/Cutscene';
import Typewriter from './components/Typewriter';
import InventoryAnimation from './components/InventoryAnimation';
import SettingsModal from './components/SettingsModal';
import InfoModal, { InfoModalKind } from './components/InfoModal';
import DevDebugModal from './components/DevDebugModal';
import LoadGameModal from './components/LoadGameModal';
import { audioService, loadAudioPreferences, saveAudioPreferences } from './lib/audioService';
import { getObjectAxes, resolveObjectDescription } from './lib/objectState';

const initialAudioPrefs = loadAudioPreferences();

/** Matches Tailwind `lg:` breakpoint — use drawers until ~1024px. */
const NARROW_MOBILE_MEDIA = '(max-width: 1023px)';

function useIsNarrowMobile() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MOBILE_MEDIA);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return narrow;
}

function getSceneInteractionLabels(scene: Scene): string[] {
  if (scene.interactionLabels?.length) return scene.interactionLabels;
  return scene.objects.map((oid) => {
    const o = OBJECTS[oid];
    return (o?.name ?? oid).toUpperCase();
  });
}

function getSceneObjectRows(scene: Scene, state: GameState) {
  return (scene.objects ?? []).map((oid) => {
    const obj = OBJECTS[oid];
    const name = (obj?.name ?? oid).toUpperCase();
    const axes = obj ? getObjectAxes(state, oid, obj) : {};
    const desc = (obj ? resolveObjectDescription(obj, axes) : '') ?? '';

    // Lightweight icon mapping (fallback: Package)
    const iconById: Record<string, keyof typeof LucideIcons> = {
      bed: 'BedDouble',
      wardrobe: 'Archive',
      rug: 'Square',
      window: 'SquareDashed',
      door: 'DoorOpen',
      gadget: 'Cpu',
      zoltar: 'Sparkles',
      bathroom_door: 'Bath',
      parents_closet: 'Shirt',
      rattle_table: 'Table',
      playpen: 'Baby',
      parents_exit_door: 'DoorClosed',
      evil_wizard: 'Skull',
    };
    const iconKey = iconById[oid];
    const Icon = ((iconKey ? (LucideIcons as any)[iconKey] : LucideIcons.Package) ?? LucideIcons.Package) as React.ComponentType<{
      size?: number;
    }>;

    return { id: oid, name, desc, Icon };
  });
}

function getFocusedGlowLabel(state: GameState): string | null {
  if (!state.focusedObjectId) return null;
  const obj = OBJECTS[state.focusedObjectId];
  return (obj?.name ?? state.focusedObjectId).toUpperCase();
}

/** Matches `processCommand`: prompt is inactive once wall-clock expiry has passed. */
function isActivePendingPrompt(pending: GameState['pendingPrompt']): boolean {
  if (!pending) return false;
  if (pending.expiresAtMs !== undefined && Date.now() > pending.expiresAtMs) return false;
  return true;
}

function getCommandSuggestions(params: {
  input: string;
  scene: Scene;
  state: GameState;
}): string[] {
  const raw = params.input.trimStart();
  const q = raw.toLowerCase();
  if (!q) return [];

  const scene = params.scene;
  const objs = (scene.objects ?? []).map((oid) => {
    const obj = OBJECTS[oid];
    return { id: oid, name: (obj?.name ?? oid).toLowerCase() };
  });

  const suggestions = new Set<string>();

  const allowSuggestion = (candidate: string): boolean => {
    const c = candidate.toLowerCase();
    for (const oid of scene.objects ?? []) {
      const obj = OBJECTS[oid];
      if (!obj) continue;
      for (const it of obj.interactions ?? []) {
        const auto = it.autoComplete !== false;
        try {
          const re = new RegExp(`^${it.regex}$`, 'i');
          if (re.test(c)) {
            return auto;
          }
        } catch {
          // ignore invalid regex
        }
      }
    }
    return true;
  };

  // Common verbs
  ['look', 'inventory', 'map', 'help', 'examine self'].forEach((c) => suggestions.add(c));

  // Exits as simple "go <dir>"
  Object.keys(scene.exits ?? {}).forEach((dir) => suggestions.add(`go ${dir}`));

  // Object-based
  objs.forEach((o) => {
    suggestions.add(`examine ${o.name}`);
    suggestions.add(`look at ${o.name}`);
    // Small curated actions; avoids trying to parse arbitrary regexes.
    if (o.id === 'wardrobe') suggestions.add('open wardrobe');
    if (o.id === 'rug') suggestions.add('look under rug');
    if (o.id === 'door') suggestions.add('open door');
    if (o.id === 'bed') suggestions.add('make bed');
    if (o.id === 'window') suggestions.add('look out window');
    if (o.id === 'gadget') suggestions.add('take gadget');
  });

  // Inventory-aware
  if (params.state.inventory.includes('old_key')) {
    suggestions.add('use key on door');
  }
  if (params.state.inventory.includes('quarter') && params.scene.id === 'zoltar_fairgrounds') {
    suggestions.add('use quarter on zoltar');
  }

  if (params.scene.id === 'bedroom') {
    suggestions.add('explore the room');
    suggestions.add('open door');
    suggestions.add('go hall');
    suggestions.add('walk through door');
    suggestions.add('leave room');
  }

  const outfit = ['giants_hoodie', 'sweatpants_gray', 'sneakers_white'] as const;
  for (const oid of outfit) {
    if (params.state.inventory.includes(oid) && !params.state.equippedItemIds?.includes(oid)) {
      suggestions.add(`equip ${ITEMS[oid].name.toLowerCase()}`);
    }
  }
  if (params.scene.id === 'hallway') {
    suggestions.add('go north');
    suggestions.add('go south');
    suggestions.add('go east');
    suggestions.add('go west');
  }
  if (params.state.inventory.includes('glacial_armor') && !params.state.equippedItemIds?.includes('glacial_armor')) {
    suggestions.add('equip glacial armor');
  }

  // Filter
  const filtered = Array.from(suggestions).filter((s) => s.toLowerCase().startsWith(q) && allowSuggestion(s));
  filtered.sort((a, b) => a.length - b.length);
  return filtered.slice(0, 8);
}

export default function App() {
  const hoverUi = () => audioService.playHoverThrottled();

  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [inputValue, setInputValue] = useState('');
  const [skipTypewriter, setSkipTypewriter] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(initialAudioPrefs.ambientVolume);
  const [sfxVolume, setSfxVolume] = useState(initialAudioPrefs.sfxVolume);
  const [isMuted, setIsMuted] = useState(initialAudioPrefs.muted);
  const [isAmbientMuted, setIsAmbientMuted] = useState(initialAudioPrefs.ambientMuted);
  const [isSfxMuted, setIsSfxMuted] = useState(initialAudioPrefs.sfxMuted);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  /** `log` opens the dev DATA_LOG debug panel (localhost / dev only). */
  const [infoModalKind, setInfoModalKind] = useState<InfoModalKind | 'log' | null>(null);
  const [sceneInteractionsVisible, setSceneInteractionsVisible] = useState(true);
  const [inventoryPanelExpanded, setInventoryPanelExpanded] = useState(true);
  const [sceneObjectsPanelExpanded, setSceneObjectsPanelExpanded] = useState(true);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState(() => listSaveSlots());
  const isNarrowMobile = useIsNarrowMobile();
  /** Fixed side drawers on small screens (game stays full-width until opened). */
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  /** Commands typed in the terminal (oldest → newest); used for Up/Down history. */
  const commandHistoryRef = useRef<string[]>([]);
  /** -1 = not navigating history; 0 = newest matching line, higher = older matches. */
  const historyNavOffsetRef = useRef(-1);
  const historyNavDraftRef = useRef<string | null>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const caretMeasureRef = useRef<HTMLSpanElement>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [cursorPixelLeft, setCursorPixelLeft] = useState(0);
  const [promptFocused, setPromptFocused] = useState(false);
  /** Keyboard highlight row in the suggestion panel (-1 = none). */
  const [suggestionHighlight, setSuggestionHighlight] = useState(-1);

  const scrollTerminalToEnd = useCallback(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /** Ambient BGM: title screen, naming, and gameplay (not when muted). Volume is applied via slider handlers, not here, so we do not call play() on every volume tick. */
  useEffect(() => {
    audioService.applyPreferences({
      ambientVolume,
      sfxVolume,
      muted: isMuted,
      ambientMuted: isAmbientMuted,
      sfxMuted: isSfxMuted,
    });
    if (isMuted) return;
    audioService.playAmbient();
  }, [state.gameStarted, state.namingPhase, isMuted, isAmbientMuted, isSfxMuted]);

  /** Retry playback after browser autoplay block — first interaction on title screen. */
  useEffect(() => {
    if (state.gameStarted || state.namingPhase) return;
    const unlock = () => {
      if (!isMuted) audioService.playAmbient();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [state.gameStarted, state.namingPhase, isMuted]);

  useEffect(() => {
    if (state.pendingItem) {
      audioService.playSound('item');
    }
  }, [state.pendingItem]);

  /** Mobile: show inventory drawer when a pickup animation runs so the new item is visible in context. */
  useEffect(() => {
    if (!state.pendingItem || !isNarrowMobile || !state.uiVisible) return;
    setMobileLeftOpen(false);
    setMobileRightOpen(true);
  }, [state.pendingItem, isNarrowMobile, state.uiVisible]);

  useEffect(() => {
    loadGame();
  }, []);

  /** Wall-clock deadline: expire without requiring another command. */
  useEffect(() => {
    if (!state.deadlineAtMs || state.isGameOver) return;
    const ms = Math.max(0, state.deadlineAtMs - Date.now());
    const t = window.setTimeout(() => {
      setState((prev) => {
        if (prev.isGameOver) return prev;
        if (!prev.deadlineAtMs || !prev.deadlineSceneId) return prev;
        if (prev.currentSceneId !== prev.deadlineSceneId) return prev;
        if (Date.now() < prev.deadlineAtMs) return prev;
        return applyDeadlineExpired(prev);
      });
    }, ms + 25);
    return () => window.clearTimeout(t);
  }, [state.deadlineAtMs, state.deadlineSceneId, state.currentSceneId, state.isGameOver]);

  /** Re-render countdown while a deadline is active. */
  const [, setDeadlineTick] = useState(0);
  useEffect(() => {
    if (!state.deadlineAtMs || state.isGameOver || state.currentSceneId !== state.deadlineSceneId) return;
    const id = window.setInterval(() => setDeadlineTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [state.deadlineAtMs, state.deadlineSceneId, state.currentSceneId, state.isGameOver]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.history]);

  useEffect(() => {
    const modalOpen = isSettingsOpen || infoModalKind !== null;
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSettingsOpen(false);
        setInfoModalKind(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSettingsOpen, infoModalKind]);

  const isCutscene = Boolean(state.gameStarted && !state.namingPhase && state.currentSceneId.startsWith('cutscene_'));
  const [postCutsceneChromeKey, setPostCutsceneChromeKey] = useState(0);
  const cutsceneSweepRef = useRef(false);

  useLayoutEffect(() => {
    if (isCutscene) {
      cutsceneSweepRef.current = true;
      return;
    }
    if (cutsceneSweepRef.current) {
      cutsceneSweepRef.current = false;
      setPostCutsceneChromeKey((k) => k + 1);
    }
  }, [isCutscene]);

  useEffect(() => {
    if (!isNarrowMobile) {
      setMobileLeftOpen(false);
      setMobileRightOpen(false);
    }
  }, [isNarrowMobile]);

  useEffect(() => {
    setMobileLeftOpen(false);
    setMobileRightOpen(false);
  }, [postCutsceneChromeKey]);

  const handleTypewriterComplete = useCallback(
    (lineIndex: number) => {
      if (lineIndex === state.history.length - 1) {
        setSkipTypewriter(true);
      }
    },
    [state.history.length],
  );

  const handleSaveProgress = useCallback(() => {
    setState((prev) => {
      saveCheckpoint(prev);
      return { ...prev, history: [...prev.history, sysLine('System state saved to floppy disk.')] };
    });
    setSaveSlots(listSaveSlots());
  }, []);

  const handleCommand = (e?: React.FormEvent, manualCommand?: string) => {
    if (e) e.preventDefault();

    if (!skipTypewriter && state.history.length > 0) {
      setSkipTypewriter(true);
      return;
    }

    const commandToProcess = manualCommand || inputValue;
    if (!commandToProcess.trim()) return;

    audioService.playSound('click');
    const newState = processCommand(state, commandToProcess);
    setState(newState);
    if (!manualCommand) {
      const trimmed = commandToProcess.trim();
      const hist = commandHistoryRef.current;
      if (trimmed && hist[hist.length - 1] !== trimmed) {
        hist.push(trimmed);
      }
    }
    historyNavOffsetRef.current = -1;
    historyNavDraftRef.current = null;
    setSuggestionHighlight(-1);
    setInputValue('');
    setSkipTypewriter(false);

    setAmbientVolume(audioService.getAmbientVolume());
    setSfxVolume(audioService.getSfxVolume());
    setIsAmbientMuted(audioService.getAmbientMuted());
    setIsSfxMuted(audioService.getSfxMuted());

    if (typeof window !== 'undefined' && window.matchMedia(NARROW_MOBILE_MEDIA).matches) {
      queueMicrotask(() => {
        promptInputRef.current?.blur();
        setMobileLeftOpen(false);
        setMobileRightOpen(false);
      });
    }
  };

  const syncCaretFromPrompt = useCallback(() => {
    const el = promptInputRef.current;
    if (el) setCaretPos(el.selectionStart ?? 0);
  }, []);

  useLayoutEffect(() => {
    setCursorPixelLeft(caretMeasureRef.current?.offsetWidth ?? 0);
  }, [inputValue, caretPos]);

  const applyPromptSuggestion = useCallback((text: string) => {
    setInputValue(text);
    setSuggestionHighlight(-1);
    historyNavOffsetRef.current = -1;
    historyNavDraftRef.current = null;
    requestAnimationFrame(() => {
      const el = promptInputRef.current;
      if (el) {
        const len = text.length;
        el.setSelectionRange(len, len);
        setCaretPos(len);
      }
    });
  }, []);

  const startGame = () => {
    setState((prev) => ({ ...prev, namingPhase: true }));
  };

  const completeNaming = (name: string) => {
    setState((prev) => ({
      ...prev,
      playerName: name,
      namingPhase: false,
      gameStarted: true,
      currentSceneId: 'cutscene_intro',
      history: [],
    }));
  };

  const cancelNaming = useCallback(() => {
    setState((prev) => ({ ...prev, namingPhase: false }));
  }, []);

  const toggleMute = () => {
    const muted = audioService.toggleMute();
    setIsMuted(muted);
    saveAudioPreferences({ ambientVolume, sfxVolume, muted, ambientMuted: isAmbientMuted, sfxMuted: isSfxMuted });
  };

  const handleAmbientVolumeChange = (newVol: number) => {
    setAmbientVolume(newVol);
    audioService.setAmbientVolume(newVol);
    saveAudioPreferences({ ambientVolume: newVol, sfxVolume, muted: isMuted, ambientMuted: isAmbientMuted, sfxMuted: isSfxMuted });
  };

  const handleSfxVolumeChange = (newVol: number) => {
    setSfxVolume(newVol);
    audioService.setSfxVolume(newVol);
    saveAudioPreferences({ ambientVolume, sfxVolume: newVol, muted: isMuted, ambientMuted: isAmbientMuted, sfxMuted: isSfxMuted });
  };

  const toggleAmbientMute = () => {
    const m = audioService.toggleAmbientMute();
    setIsAmbientMuted(m);
    saveAudioPreferences({ ambientVolume, sfxVolume, muted: isMuted, ambientMuted: m, sfxMuted: isSfxMuted });
  };

  const toggleSfxMute = () => {
    const m = audioService.toggleSfxMute();
    setIsSfxMuted(m);
    saveAudioPreferences({ ambientVolume, sfxVolume, muted: isMuted, ambientMuted: isAmbientMuted, sfxMuted: m });
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to restart? All progress will be lost.')) {
      setState(INITIAL_STATE);
      localStorage.removeItem('cavern_evil_wizard_save');
      audioService.stopAmbient();
    }
  };

  const handleRebootConfirm = useCallback(() => {
    setInfoModalKind(null);
    setInputValue('');
    setSkipTypewriter(false);
    setState(INITIAL_STATE);
    audioService.stopAmbient();
  }, []);

  const isDevDebugUi =
    typeof window !== 'undefined' &&
    (((import.meta as any).env?.DEV as boolean | undefined) || ['localhost', '127.0.0.1'].includes(window.location.hostname));

  const infoModal = (
    <>
      {infoModalKind === 'log' && isDevDebugUi && (
        <DevDebugModal state={state} onClose={() => setInfoModalKind(null)} />
      )}
      {infoModalKind && infoModalKind !== 'log' && (
        <InfoModal
          kind={infoModalKind as InfoModalKind}
          onClose={() => setInfoModalKind(null)}
          onRebootConfirm={handleRebootConfirm}
        />
      )}
    </>
  );

  const loadModal = (
    <LoadGameModal
      isOpen={isLoadModalOpen}
      slots={saveSlots}
      onClose={() => setIsLoadModalOpen(false)}
      onLoad={(slotId) => {
        const loaded = loadSaveSlot(slotId);
        if (loaded) {
          setIsLoadModalOpen(false);
          setState(loaded);
        } else {
          alert('Failed to load that save slot.');
        }
      }}
      onDeleteSlot={(slotId) => {
        deleteSaveSlot(slotId);
        setSaveSlots(listSaveSlots());
      }}
      onSaveSlotNote={(slotId, note) => {
        updateSaveSlotNote(slotId, note);
        setSaveSlots(listSaveSlots());
      }}
    />
  );

  const settingsModal = (
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      onSave={handleSaveProgress}
      onReset={resetGame}
      ambientVolume={ambientVolume}
      onAmbientVolumeChange={handleAmbientVolumeChange}
      sfxVolume={sfxVolume}
      onSfxVolumeChange={handleSfxVolumeChange}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      isAmbientMuted={isAmbientMuted}
      onToggleAmbientMute={toggleAmbientMute}
      isSfxMuted={isSfxMuted}
      onToggleSfxMute={toggleSfxMute}
      onSystemReboot={() => {
        setIsSettingsOpen(false);
        setInfoModalKind('reboot');
      }}
      onHelp={() => {
        setIsSettingsOpen(false);
        setInfoModalKind('help');
      }}
      onDataLog={
        isDevDebugUi
          ? () => {
              setIsSettingsOpen(false);
              setInfoModalKind('log');
            }
          : undefined
      }
    />
  );

  if (!state.gameStarted && !state.namingPhase) {
    return (
      <>
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#131313] p-4">
          <div className="pointer-events-none fixed inset-0 opacity-30 crt-scanlines" />

          <button
            type="button"
            onMouseEnter={hoverUi}
            onClick={() => setIsSettingsOpen(true)}
            className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top,0px)+0.5rem)] z-40 flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[#35ebeb] hover:bg-[#35ebeb]/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35ebeb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
            aria-label="Open settings"
          >
            <CogIcon size={18} />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="z-10 text-center"
          >
            <h1 className="mb-4 text-6xl font-black leading-none tracking-tighter text-[#ffffff] md:text-9xl">
              CAVERN
              <br />
              <span className="mt-2 block text-4xl tracking-widest text-[#ffaaf6] md:text-6xl">OF THE EVIL WIZARD</span>
            </h1>

            <div className="mt-4 mb-12 flex items-center justify-center gap-4">
              <div className="h-1 w-24 bg-[#35ebeb]" />
              <span className="text-sm font-bold uppercase tracking-[0.4em] text-[#35ebeb]">SENTIENT TERMINAL v1.9.88</span>
              <div className="h-1 w-24 bg-[#35ebeb]" />
            </div>

            <div className="relative mx-auto max-w-md border-4 border-[#35ebeb] bg-[#1b1b1b] p-2">
              <div className="absolute -left-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
              <div className="absolute -right-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
              <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-[#35ebeb]" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#35ebeb]" />

              <div className="flex flex-col gap-4 border-2 border-[#35ebeb]/30 bg-[#131313] p-8">
                <button
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={startGame}
                  className="flex w-full items-center justify-between bg-[#ffffff] px-6 py-4 font-bold uppercase tracking-widest text-[#002020] transition-all hover:bg-[#35ebeb]"
                >
                  <span>START GAME</span>
                  <Play className="shrink-0" size={20} />
                </button>

                {listSaveSlots().length > 0 && (
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => {
                      const slots = listSaveSlots();
                      setSaveSlots(slots);
                      setIsLoadModalOpen(true);
                    }}
                    className="flex w-full items-center justify-between border-2 border-[#ffaaf6] px-6 py-4 font-bold uppercase tracking-widest text-[#ffaaf6] transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                  >
                    <span>LOAD GAME</span>
                    <Save className="shrink-0" size={20} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <footer className="fixed bottom-0 z-30 w-full border-t-4 border-[#ffffff] bg-[#131313] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] text-[10px] uppercase tracking-widest text-[#ffaaf6] md:px-4 md:py-3">
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-y-2">
              <div className="truncate text-center md:text-left">(C) 1988 SENTIENT TERMINAL SYSTEMS</div>
              <div className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-2 md:flex md:justify-end md:gap-8">
                <div className="group flex items-center gap-2">
                  <button type="button" onMouseEnter={hoverUi} onClick={toggleMute} className="hover:text-[#35ebeb]" aria-label="Toggle mute">
                    {isMuted ? <VolumeX size={14} /> : ambientVolume > 0.5 ? <Volume2 size={14} /> : <Volume1 size={14} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ambientVolume}
                    onChange={(e) => handleAmbientVolumeChange(parseFloat(e.target.value))}
                    className="h-1 w-20 cursor-pointer appearance-none bg-[#353535] accent-[#35ebeb] md:w-24 group-hover:bg-[#35ebeb]/30"
                    aria-label="Volume"
                  />
                </div>
                <button type="button" onMouseEnter={hoverUi} className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('reboot')}>
                  SYSTEM_REBOOT
                </button>
              </div>
            </div>
          </footer>
        </div>
        {infoModal}
        {loadModal}
        {settingsModal}
      </>
    );
  }

  if (state.namingPhase) {
    return (
      <>
        <NamingScreen onComplete={completeNaming} onCancel={cancelNaming} />
        <button
          type="button"
          onMouseEnter={hoverUi}
          onClick={() => setIsSettingsOpen(true)}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top,0px)+0.5rem)] z-[70] flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[#35ebeb] hover:bg-[#35ebeb]/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35ebeb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313] md:hidden"
          aria-label="Settings and audio"
        >
          <CogIcon size={22} />
        </button>
        {infoModal}
        {loadModal}
        {settingsModal}
      </>
    );
  }

  const currentScene = SCENES[state.currentSceneId];
  const deadlineSecondsLeft =
    state.deadlineAtMs && !state.isGameOver && state.currentSceneId === state.deadlineSceneId
      ? Math.max(0, Math.ceil((state.deadlineAtMs - Date.now()) / 1000))
      : null;
  const interactionLabels = getSceneInteractionLabels(currentScene);
  const sceneObjectRows = getSceneObjectRows(currentScene, state);
  const commandSuggestions = getCommandSuggestions({ input: inputValue, scene: currentScene, state });
  const awaitingPromptResponse = isActivePendingPrompt(state.pendingPrompt);
  const focusedGlowLabel = getFocusedGlowLabel(state);
  const suggestionActiveIndex =
    suggestionHighlight >= 0 && suggestionHighlight < commandSuggestions.length ? suggestionHighlight : -1;

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (state.isGameOver) return;
    const suggestions = getCommandSuggestions({ input: inputValue, scene: currentScene, state });

    if (suggestions.length > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const len = suggestions.length;
      const goDown = e.key === 'ArrowDown';
      setSuggestionHighlight((prev) => {
        if (goDown) {
          if (prev < 0) return 0;
          return (prev + 1) % len;
        }
        if (prev < 0) return len - 1;
        return (prev - 1 + len) % len;
      });
      return;
    }

    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      const idx =
        suggestionHighlight >= 0 && suggestionHighlight < suggestions.length ? suggestionHighlight : 0;
      const pick = suggestions[idx];
      if (pick) applyPromptSuggestion(pick);
      return;
    }

    if (e.key === 'Enter' && suggestions.length > 0 && suggestionHighlight >= 0) {
      e.preventDefault();
      const idx = Math.min(suggestionHighlight, suggestions.length - 1);
      const pick = suggestions[idx];
      if (pick) applyPromptSuggestion(pick);
      return;
    }

    if (e.key === 'Escape' && suggestionHighlight >= 0) {
      e.preventDefault();
      setSuggestionHighlight(-1);
      return;
    }

    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    const prefix = inputValue;
    const matches: string[] = [];
    for (let i = commandHistoryRef.current.length - 1; i >= 0; i--) {
      const h = commandHistoryRef.current[i];
      if (h.toLowerCase().startsWith(prefix.toLowerCase())) matches.push(h);
    }
    if (matches.length === 0) return;

    e.preventDefault();

    if (e.key === 'ArrowUp') {
      if (historyNavOffsetRef.current < 0) {
        historyNavDraftRef.current = inputValue;
        historyNavOffsetRef.current = 0;
      } else {
        historyNavOffsetRef.current = Math.min(historyNavOffsetRef.current + 1, matches.length - 1);
      }
      const next = matches[historyNavOffsetRef.current];
      setInputValue(next);
      requestAnimationFrame(() => {
        const el = promptInputRef.current;
        if (el) {
          const len = next.length;
          el.setSelectionRange(len, len);
          setCaretPos(len);
        }
      });
      return;
    }

    if (historyNavOffsetRef.current < 0) return;
    if (historyNavOffsetRef.current === 0) {
      const draft = historyNavDraftRef.current ?? '';
      historyNavOffsetRef.current = -1;
      historyNavDraftRef.current = null;
      setInputValue(draft);
      requestAnimationFrame(() => {
        const el = promptInputRef.current;
        if (el) {
          el.setSelectionRange(draft.length, draft.length);
          setCaretPos(draft.length);
        }
      });
      return;
    }
    historyNavOffsetRef.current--;
    const next = matches[historyNavOffsetRef.current];
    setInputValue(next);
    requestAnimationFrame(() => {
      const el = promptInputRef.current;
      if (el) {
        const len = next.length;
        el.setSelectionRange(len, len);
        setCaretPos(len);
      }
    });
  };

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden bg-[#131313] font-sans text-[#e2e2e2]">
        <div className="pointer-events-none fixed inset-0 opacity-20 crt-scanlines" />

        {isNarrowMobile && (
          <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-[#ffffff]/15 bg-[#131313]/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur lg:hidden">
            {state.uiVisible ? (
              <button
                type="button"
                onMouseEnter={hoverUi}
                onClick={() => {
                  setMobileRightOpen(false);
                  setMobileLeftOpen((o) => !o);
                }}
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-md p-2 text-[#35ebeb] hover:bg-[#35ebeb]/10 hover:text-[#ffffff] active:scale-[0.98]',
                  mobileLeftOpen && 'bg-[#35ebeb]/20 text-[#ffffff]',
                )}
                aria-expanded={mobileLeftOpen}
                aria-label={mobileLeftOpen ? 'Close player menu' : 'Open player menu (status, map, inventory)'}
              >
                <Menu size={24} strokeWidth={2.5} />
              </button>
            ) : (
              <span className="block h-11 w-11" aria-hidden />
            )}

            <div className="text-center text-[10px] font-black uppercase tracking-widest text-[#ffaaf6]">Sentient Terminal</div>

            <button
              type="button"
              onMouseEnter={hoverUi}
              onClick={() => {
                setMobileLeftOpen(false);
                setMobileRightOpen(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md p-2 text-[#35ebeb] hover:bg-[#35ebeb]/10 hover:text-[#ffffff] active:scale-[0.98]"
              aria-label="Open inventory and scene panel"
            >
              <PackageOpen size={24} strokeWidth={2} />
            </button>
          </div>
        )}

        <LayoutGroup id="scene-viewport">
          <AnimatePresence>
            {isCutscene && (
              <Cutscene
                key={state.currentSceneId}
                scene={currentScene}
                gameChromeVisible={state.uiVisible}
                onChoice={(choice) => handleCommand(undefined, choice)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {state.pendingItem && (
              <InventoryAnimation
                itemName={ITEMS[state.pendingItem].name}
                iconName={ITEMS[state.pendingItem].icon}
                onComplete={() => setState((prev) => ({ ...prev, pendingItem: null }))}
              />
            )}
          </AnimatePresence>

        <div
          className={clsx(
            'relative flex min-h-0 flex-1 overflow-hidden',
            isNarrowMobile && 'pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]',
          )}
        >
          <AnimatePresence>
            {state.uiVisible && (
              <motion.aside
                key={`left-${postCutsceneChromeKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: postCutsceneChromeKey > 0 ? 0.32 : 0, ease: [0.4, 0, 0.2, 1] }}
                className={clsx(
                  'z-40 flex w-64 flex-col border-r-4 border-[#353535] bg-[#1b1b1b]',
                  'lg:relative lg:h-auto lg:max-h-none lg:translate-x-0',
                  'max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-[56] max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:w-[min(22rem,92vw)] max-lg:overflow-y-auto max-lg:shadow-[8px_0_40px_rgba(0,0,0,0.65)] max-lg:transition-transform max-lg:duration-300 max-lg:ease-out',
                  isNarrowMobile && !mobileLeftOpen && 'max-lg:pointer-events-none max-lg:-translate-x-full',
                  isNarrowMobile && mobileLeftOpen && 'max-lg:translate-x-0',
                )}
              >
                {isNarrowMobile && (
                  <div className="flex items-center justify-between border-b border-[#353535] px-3 py-2 lg:hidden">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#ffaaf6]">Player menu</span>
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => setMobileLeftOpen(false)}
                      className="rounded border border-[#353535] p-2 text-[#35ebeb] hover:bg-[#353535]"
                      aria-label="Close player menu"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <div className="border-b-4 border-[#353535] p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-[#ffaaf6] bg-[#353535]">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(
                          [state.playerName, ...(state.equippedItemIds ?? [])].join('|'),
                        )}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-lg font-bold uppercase tracking-tighter text-[#ffaaf6]">{state.playerName}</div>
                      <div className="text-[10px] font-black text-[#35ebeb]">
                        HP: {state.hp}/{state.maxHp} · SCORE: {state.score ?? 0}
                        {deadlineSecondsLeft != null ? (
                          <span className="ml-2 text-[#ffaaf6]">· TIME: {deadlineSecondsLeft}s</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full bg-[#131313]">
                    <div className="h-full bg-[#35ebeb]" style={{ width: `${(state.hp / state.maxHp) * 100}%` }} />
                  </div>
                </div>

                <nav className="flex-1 py-4">
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => setSceneInteractionsVisible((v) => !v)}
                    className="flex w-full items-center gap-4 bg-[#ffffff] p-4 text-sm font-black uppercase tracking-tighter text-[#002020]"
                  >
                    <Heart size={20} /> STATUS
                  </button>
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => {
                      if (isNarrowMobile) {
                        setMobileLeftOpen(false);
                        setMobileRightOpen(true);
                      } else {
                        handleCommand(undefined, 'view inventory');
                        setMobileLeftOpen(false);
                      }
                    }}
                    className="flex w-full items-center gap-4 p-4 text-sm uppercase tracking-tighter text-[#35ebeb] opacity-70 transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                  >
                    <Backpack size={20} /> INVENTORY
                  </button>
                  {state.hasMap && (
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => {
                        handleCommand(undefined, 'view map');
                        setMobileLeftOpen(false);
                      }}
                      className="flex w-full items-center gap-4 p-4 text-sm uppercase tracking-tighter text-[#35ebeb] opacity-70 transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                    >
                      <MapIcon size={20} /> MAP
                    </button>
                  )}
                </nav>

                <div className="mt-auto p-6">
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => {
                      setMobileLeftOpen(false);
                      setMobileRightOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 border-2 border-[#35ebeb] py-3 text-xs font-black uppercase text-[#35ebeb] transition-all hover:bg-[#35ebeb] hover:text-[#002020]"
                  >
                    <CogIcon size={18} /> SETTINGS
                  </button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {state.uiVisible && isNarrowMobile && mobileLeftOpen && (
            <button
              type="button"
              aria-label="Dismiss player menu"
              className="fixed inset-0 z-[50] bg-black/60 md:hidden"
              onClick={() => setMobileLeftOpen(false)}
            />
          )}

          <main className="relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#131313]">
            <section
              className={clsx(
                'group relative shrink-0 overflow-hidden border-b-4 border-[#353535] bg-black',
                'md:h-[50%]',
                isNarrowMobile ? 'h-[42%] min-h-[9.5rem]' : 'h-[50%]',
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.currentSceneId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                >
                  {(() => {
                    const viewportSrc = currentScene.image ?? currentScene.background;
                    const handoffId = currentScene.viewportHandoffLayoutId;
                    return viewportSrc ? (
                      <motion.div
                        layoutId={!isCutscene && handoffId ? handoffId : undefined}
                        className="absolute inset-0 h-full w-full overflow-hidden border-0"
                        transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.85 }}
                      >
                        <img
                          src={viewportSrc}
                          alt={currentScene.title}
                          className="h-full w-full object-cover opacity-80"
                          referrerPolicy="no-referrer"
                        />
                      </motion.div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-40">
                        <div className="text-center font-mono text-[#35ebeb]">
                          <div className="mb-4 text-4xl">[ VISUAL FEED ]</div>
                          <div className="text-xl uppercase tracking-widest">
                            {currentScene.title.replace('{{name}}', state.playerName)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-20" />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />

              {focusedGlowLabel && (
                <>
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_3px_rgba(53,235,235,0.25),inset_0_0_45px_rgba(53,235,235,0.18)]" />
                  <div className="pointer-events-none absolute left-4 top-4 border-l-4 border-[#ffaaf6] bg-[#1b1b1b] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#ffaaf6]">
                    FOCUS: {focusedGlowLabel}
                  </div>
                </>
              )}

              <div className="absolute right-4 top-4 border-l-4 border-[#35ebeb] bg-[#1b1b1b] px-3 py-1 text-[10px] font-bold uppercase text-[#35ebeb]">
                AREA: 0x{state.currentSceneId.toUpperCase()}
              </div>

              {state.isGameOver && (
                <div className="pointer-events-auto absolute inset-0 z-[80] flex flex-col items-center justify-center bg-red-900/50">
                  <AlertTriangle className="mb-4 animate-pulse text-white" size={64} />
                  <h2 className="mb-8 text-6xl font-black tracking-widest text-white">GAME OVER</h2>
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSkipTypewriter(true);
                      if (state.lastCheckpoint) {
                        setState(resumeFromCheckpointWithFeedback(state.lastCheckpoint));
                      } else {
                        setState({ ...INITIAL_STATE, playerName: state.playerName });
                      }
                    }}
                    className="bg-white px-8 py-4 font-black uppercase tracking-widest text-red-900 transition-all hover:bg-[#35ebeb]"
                  >
                    {state.lastCheckpoint ? 'RELOAD LAST CHECKPOINT' : 'START OVER'}
                  </button>
                </div>
              )}
            </section>

            <motion.section
              key={postCutsceneChromeKey}
              initial={postCutsceneChromeKey === 0 ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: postCutsceneChromeKey === 0 ? 0 : 0.55,
                delay: postCutsceneChromeKey === 0 ? 0 : 0.36,
                ease: [0.4, 0, 0.2, 1],
              }}
              className={clsx(
                'flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6',
                isNarrowMobile && 'min-h-0',
              )}
              onClick={() => setSkipTypewriter(true)}
            >
              <div
                className={clsx(
                  'flex min-h-0 flex-1 flex-col overflow-hidden transition-[padding,margin] duration-200',
                  awaitingPromptResponse && 'ml-2 border-l-2 border-[#35ebeb]/35 pl-4 md:ml-3 md:pl-5',
                )}
              >
              <div className="terminal-scroll mb-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 font-mono md:mb-4 md:pr-4">
                {state.history.map((line, i) => {
                  const isLast = i === state.history.length - 1;
                  if (line.startsWith('>')) {
                    return (
                      <div key={i} className="font-bold text-[#35ebeb]">
                        {line}
                      </div>
                    );
                  }
                  if (line.startsWith(SYS_PREFIX)) {
                    return (
                      <div key={i} className="text-sm text-[#a8a8a8]">
                        {line.slice(SYS_PREFIX.length)}
                      </div>
                    );
                  }
                  if (line.startsWith(FATAL_PREFIX)) {
                    const deathText = line.slice(FATAL_PREFIX.length);
                    return (
                      <div key={i} className="font-black uppercase tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">
                        <Typewriter
                          text={deathText}
                          disableInlineHighlights
                          skip={skipTypewriter || !isLast}
                          onComplete={() => handleTypewriterComplete(i)}
                          onContentChange={scrollTerminalToEnd}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="opacity-90 text-[#e2e2e2]">
                      <Typewriter
                        text={line}
                        skip={skipTypewriter || !isLast}
                        onComplete={() => handleTypewriterComplete(i)}
                        onContentChange={scrollTerminalToEnd}
                      />
                    </div>
                  );
                })}
                <div ref={terminalEndRef} />
              </div>

              <form
                onSubmit={handleCommand}
                className={clsx(
                  'relative flex shrink-0 items-center gap-3 border-l-4 bg-[#1b1b1b] p-3 md:gap-4 md:p-4',
                  awaitingPromptResponse ? 'border-[#ffaaf6]/60' : 'border-[#35ebeb]',
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xl font-black tracking-widest text-[#35ebeb]">&gt;</span>
                <div
                  className="relative min-w-0 flex-1"
                  onPointerDown={(e) => {
                    if (!isNarrowMobile || state.isGameOver) return;
                    const t = e.target as HTMLElement;
                    if (t.closest('button')) return;
                    if (t === promptInputRef.current) return;
                    promptInputRef.current?.focus();
                  }}
                >
                  <div className="relative flex min-w-0 items-center">
                    <span
                      ref={caretMeasureRef}
                      aria-hidden
                      className="invisible pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-pre font-mono text-base font-bold uppercase leading-none tracking-wider"
                    >
                      {inputValue.slice(0, caretPos)}
                    </span>
                    <input
                      ref={promptInputRef}
                      autoFocus={!isNarrowMobile}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={inputValue}
                      onChange={(e) => {
                        historyNavOffsetRef.current = -1;
                        historyNavDraftRef.current = null;
                        setSuggestionHighlight(-1);
                        setInputValue(e.target.value);
                        setCaretPos(e.target.selectionStart ?? 0);
                      }}
                      onKeyDown={handlePromptKeyDown}
                      onKeyUp={syncCaretFromPrompt}
                      onClick={syncCaretFromPrompt}
                      onSelect={syncCaretFromPrompt}
                      onFocus={() => setPromptFocused(true)}
                      onBlur={() => setPromptFocused(false)}
                      className="relative z-10 w-full border-none bg-transparent py-0 font-mono text-base font-bold uppercase leading-none tracking-wider text-[#35ebeb] caret-transparent placeholder:text-[#35ebeb]/30 focus:ring-0"
                      placeholder={
                        inputValue ? '' : awaitingPromptResponse ? 'ENTER RESPONSE...' : 'ENTER COMMAND...'
                      }
                      disabled={state.isGameOver}
                    />
                    {promptFocused && !state.isGameOver && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 z-20 h-[1.15em] w-[0.55em] -translate-y-1/2 bg-[#35ebeb] cursor-blink"
                        style={{ left: cursorPixelLeft }}
                      />
                    )}
                  </div>

                  {commandSuggestions.length > 0 && !state.isGameOver && (
                    <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden border-2 border-[#35ebeb]/50 bg-[#131313] shadow-[0_0_30px_rgba(53,235,235,0.15)]">
                      {commandSuggestions.map((s, idx) => (
                        <button
                          key={s}
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => applyPromptSuggestion(s)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-[#353535] hover:text-[#35ebeb] ${
                            suggestionActiveIndex === idx ? 'bg-[#353535] text-[#35ebeb]' : 'text-[#35ebeb]/90'
                          }`}
                        >
                          <span className="truncate">{s}</span>
                          <span className="ml-3 shrink-0 text-[#e2e2e2]/40">
                            {suggestionActiveIndex === idx ? '↵ / TAB' : 'TAB'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {isNarrowMobile && !state.isGameOver && (
                  <button
                    type="submit"
                    onMouseEnter={hoverUi}
                    className="shrink-0 rounded border-2 border-[#35ebeb] bg-[#131313] p-2 text-[#35ebeb] active:scale-[0.99] lg:hidden"
                    aria-label={awaitingPromptResponse ? 'Submit response' : 'Submit command'}
                  >
                    <CornerDownLeft size={18} strokeWidth={2.5} />
                  </button>
                )}
                {!state.uiVisible && (
                  <div className="hidden animate-pulse text-[10px] uppercase tracking-widest text-[#35ebeb]/50 md:block">
                    Try: &quot;look&quot;, &quot;open wardrobe&quot;, &quot;take key&quot;
                  </div>
                )}
              </form>
              </div>
            </motion.section>
          </main>

          {state.uiVisible && isNarrowMobile && mobileRightOpen && (
            <button
              type="button"
              aria-label="Dismiss inventory panel"
              className="fixed inset-0 z-[50] bg-black/60 lg:hidden"
              onClick={() => setMobileRightOpen(false)}
            />
          )}

          <AnimatePresence>
            {state.uiVisible && (
              <motion.aside
                key={`right-${postCutsceneChromeKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: postCutsceneChromeKey > 0 ? 0.34 : 0, ease: [0.4, 0, 0.2, 1] }}
                className={clsx(
                  'z-40 flex min-h-0 w-80 flex-col border-l-4 border-[#353535] bg-[#1b1b1b] p-0',
                  'lg:relative lg:h-auto lg:max-h-none lg:translate-x-0',
                  'max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:z-[56] max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:w-[min(22rem,92vw)] max-lg:overflow-y-auto max-lg:shadow-[-8px_0_40px_rgba(0,0,0,0.65)] max-lg:transition-transform max-lg:duration-300 max-lg:ease-out',
                  isNarrowMobile && !mobileRightOpen && 'max-lg:pointer-events-none max-lg:translate-x-full',
                  isNarrowMobile && mobileRightOpen && 'max-lg:translate-x-0',
                )}
              >
                {isNarrowMobile && (
                  <div className="flex items-center justify-between border-b border-[#353535] px-3 py-2 lg:hidden">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#ffaaf6]">Inventory &amp; scene</span>
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => setMobileRightOpen(false)}
                      className="rounded border border-[#353535] p-2 text-[#35ebeb] hover:bg-[#353535]"
                      aria-label="Close inventory panel"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    className={clsx(
                      'flex min-h-0 flex-col border-[#353535] p-4 md:p-6',
                      sceneInteractionsVisible && 'max-md:border-b',
                      inventoryPanelExpanded ? 'flex-1' : 'flex-none',
                    )}
                  >
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => setInventoryPanelExpanded((v) => !v)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-3',
                        inventoryPanelExpanded ? 'mb-3 md:mb-4' : 'mb-0',
                      )}
                      aria-expanded={inventoryPanelExpanded}
                    >
                      <span className="flex min-w-0 items-center gap-2 font-black uppercase tracking-widest text-[#ffaaf6]">
                        <Backpack size={18} /> INVENTORY
                      </span>
                      <span className="shrink-0 font-mono text-xs font-black text-[#35ebeb]">
                        {inventoryPanelExpanded ? '−' : '+'}
                      </span>
                    </button>
                    {inventoryPanelExpanded && (
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain">
                        {state.inventory.length > 0 ? (
                          state.inventory.map((id) => {
                            const iconKey = ITEMS[id].icon as keyof typeof LucideIcons | undefined;
                            const Icon =
                              (iconKey && (LucideIcons as any)[iconKey]
                                ? ((LucideIcons as any)[iconKey] as React.ComponentType<{ size?: number }>)
                                : (LucideIcons.Package as React.ComponentType<{ size?: number }>));
                            return (
                              <div
                                key={id}
                                className="group flex items-start gap-3 border-l-4 border-[#35ebeb] bg-[#131313] p-3 transition-all hover:bg-[#353535]"
                              >
                                <div className="mt-1 text-[#35ebeb]">
                                  <Icon size={16} />
                                </div>
                                <div>
                                  <div className="text-sm font-bold uppercase text-[#ffffff]">{ITEMS[id].name}</div>
                                  <div className="mt-1 text-[10px] text-[#e2e2e2]/60">{ITEMS[id].description}</div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-[10px] italic uppercase tracking-widest text-[#e2e2e2]/40">
                            Inventory is empty...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {sceneInteractionsVisible && (
                    <div
                      className={clsx(
                        'flex min-h-0 flex-col overflow-hidden p-4 md:border-t md:border-[#353535] md:p-6',
                        sceneObjectsPanelExpanded ? 'flex-1' : 'flex-none',
                      )}
                    >
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => setSceneObjectsPanelExpanded((v) => !v)}
                        className={clsx(
                          'flex w-full items-center justify-between gap-3',
                          sceneObjectsPanelExpanded ? 'mb-3 md:mb-4' : 'mb-0',
                        )}
                        aria-expanded={sceneObjectsPanelExpanded}
                      >
                        <span className="flex min-w-0 items-center gap-2 font-black uppercase tracking-widest text-[#e2e2e2]/70">
                          SCENE OBJECTS
                        </span>
                        <span className="shrink-0 font-mono text-xs font-black text-[#35ebeb]">
                          {sceneObjectsPanelExpanded ? '−' : '+'}
                        </span>
                      </button>
                      {sceneObjectsPanelExpanded && (
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain">
                          {sceneObjectRows.map(({ id, name, desc, Icon }) => (
                            <div
                              key={id}
                              className="group flex items-start gap-3 border-l-4 border-[#353535] bg-[#0f0f0f] p-3 transition-all hover:bg-[#202020]"
                            >
                              <div className="mt-1 text-[#e2e2e2]/60">
                                <Icon size={16} />
                              </div>
                              <div>
                                <div className="text-sm font-bold uppercase text-[#e2e2e2]/90">{name}</div>
                                <div className="mt-1 text-[10px] text-[#e2e2e2]/45">{desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto hidden shrink-0 border-t border-[#353535] p-6 pt-4 md:block">
                  <div className="border-b-4 border-[#ffaaf6] bg-[#131313] p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-[#ffaaf6]">System Status</div>
                    <div className="text-xs font-bold text-[#ffffff]">KERNEL: READY</div>
                    <div className="text-xs font-bold text-[#ffffff]">MEM: 640KB ALLOCATED</div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

        </div>
        </LayoutGroup>

        {settingsModal}

        <footer className="z-50 border-t-4 border-[#ffffff] bg-[#131313] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] text-[10px] uppercase tracking-widest text-[#ffaaf6] md:px-8 md:py-2">
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-3 md:block">
              <div className="truncate text-left text-[9px] md:text-left md:text-[10px]">(C) 1988 SENTIENT TERMINAL SYSTEMS</div>
              {isNarrowMobile && (
                <button
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={() => {
                    setMobileLeftOpen(false);
                    setMobileRightOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="shrink-0 rounded-full p-2 text-[#35ebeb] hover:bg-[#35ebeb]/10 hover:text-[#ffffff] active:scale-[0.98] lg:hidden"
                  aria-label="Open settings"
                >
                  <CogIcon size={18} strokeWidth={2} />
                </button>
              )}
            </div>
            <div className="hidden flex-wrap items-center justify-center gap-6 md:flex md:justify-end">
              <div className="group flex items-center gap-2">
                <button type="button" onMouseEnter={hoverUi} onClick={toggleMute} className="hover:text-[#35ebeb]" aria-label="Toggle mute">
                  {isMuted ? <VolumeX size={14} /> : ambientVolume > 0.5 ? <Volume2 size={14} /> : <Volume1 size={14} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={ambientVolume}
                  onChange={(e) => handleAmbientVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-16 cursor-pointer appearance-none bg-[#353535] accent-[#35ebeb] group-hover:bg-[#35ebeb]/30 md:w-20"
                  aria-label="Volume"
                />
              </div>
              <button type="button" onMouseEnter={hoverUi} className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('reboot')}>
                SYSTEM_REBOOT
              </button>
              {isDevDebugUi && (
                <button type="button" onMouseEnter={hoverUi} className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('log')}>
                  DATA_LOG
                </button>
              )}
              <button type="button" onMouseEnter={hoverUi} className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('help')}>
                HELP
              </button>
            </div>
          </div>
        </footer>
      </div>
      {infoModal}
      {loadModal}
    </>
  );
}
