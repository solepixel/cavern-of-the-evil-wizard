/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, startTransition } from 'react';
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
  HardHat,
  Shirt,
  Hand,
  PersonStanding,
  Footprints,
  Sword,
  Boxes,
  ChevronDown,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { GameState, Scene } from './types';
import { INITIAL_STATE, SCENES, ITEMS, OBJECTS } from './gameData';
import {
  processCommand,
  equipItemFromInventory,
  deriveEquippedSlots,
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
import EquippedStatusModal from './components/EquippedStatusModal.tsx';
import { audioService, loadAudioPreferences, saveAudioPreferences } from './lib/audioService';
import { getSceneAreaDisplayLabel } from './lib/sceneAreaLabel';
import AvatarPickerModal from './components/AvatarPickerModal';
import { StoredLocalAvatar, clearLocalAvatar, imageToPixelAvatarDataUrl, loadLocalAvatar, saveLocalAvatar } from './lib/localAvatar';
import { DicebearProfile, buildDicebearAvatarUrl, loadDicebearProfile, saveDicebearProfile } from './lib/dicebearAvatar';
import { getHelpText } from './lib/helpText';

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

function getSceneObjectRows(scene: Scene) {
  return (scene.objects ?? []).map((oid) => {
    const obj = OBJECTS[oid];
    const name = (obj?.name ?? oid).toUpperCase();

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

    return { id: oid, name, Icon };
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

function hasAnyEquippableItem(state: GameState): boolean {
  for (const id of state.inventory ?? []) {
    const it = ITEMS[id];
    if (!it) continue;
    if (it.itemType === 'gear' || it.itemType === 'weapon' || it.equippable) return true;
  }
  return false;
}

function hasAnyWeaponItem(state: GameState): boolean {
  const equipped = new Set(state.equippedItemIds ?? []);
  for (const id of [...(state.inventory ?? []), ...equipped]) {
    const it = ITEMS[id];
    if (it?.itemType === 'weapon') return true;
  }
  return false;
}

function hasAnyHeadItem(state: GameState): boolean {
  const equipped = new Set(state.equippedItemIds ?? []);
  for (const id of [...(state.inventory ?? []), ...equipped]) {
    const it = ITEMS[id];
    if (!it) continue;
    if ((it.gearSlot ?? it.equipmentSlot) === 'head') return true;
  }
  return false;
}

function hasAnyHandsItem(state: GameState): boolean {
  const equipped = new Set(state.equippedItemIds ?? []);
  for (const id of [...(state.inventory ?? []), ...equipped]) {
    const it = ITEMS[id];
    if (!it) continue;
    if ((it.gearSlot ?? it.equipmentSlot) === 'hands') return true;
  }
  return false;
}

function getCommandSuggestions(params: {
  input: string;
  scene: Scene;
  state: GameState;
}): string[] {
  const raw = params.input.trimStart();
  const q = raw.toLowerCase();
  if (!q || q.length > 40) return [];

  const scene = params.scene;
  const objs = (scene.objects ?? []).map((oid) => {
    const obj = OBJECTS[oid];
    return { id: oid, name: (obj?.name ?? oid).toLowerCase() };
  });

  const suggestions = new Set<string>();

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
  const filtered = Array.from(suggestions).filter((s) => s.toLowerCase().startsWith(q));
  filtered.sort((a, b) => a.length - b.length);
  return filtered.slice(0, 5);
}

export default function App() {
  const hoverUi = () => audioService.playHoverThrottled();

  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [localAvatar, setLocalAvatar] = useState(() => loadLocalAvatar());
  const [draftAvatar, setDraftAvatar] = useState<StoredLocalAvatar | null>(() => loadLocalAvatar());
  const [dicebearProfile, setDicebearProfile] = useState<DicebearProfile>(() => loadDicebearProfile());
  const [inputValue, setInputValue] = useState('');
  const [skipTypewriter, setSkipTypewriter] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
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
  const [activePickupAnimations, setActivePickupAnimations] = useState<
    Array<{ key: string; id: string; target: 'inventory' | 'equipment'; startDelayMs: number }>
  >([]);
  const [pendingCutsceneState, setPendingCutsceneState] = useState<GameState | null>(null);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isEquippedModalOpen, setIsEquippedModalOpen] = useState(false);
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
    const queued = state.pendingItemQueue ?? [];
    if (!queued.length) return;
    setActivePickupAnimations((prev) => {
      const offset = prev.length > 0 ? 300 : 0;
      return [
        ...prev,
        ...queued.map((entry, idx) => ({
          key: `${entry.id}-${entry.target}-${Date.now()}-${idx}-${Math.random().toString(16).slice(2, 8)}`,
          id: entry.id,
          target: entry.target,
          startDelayMs: offset + idx * 300,
        })),
      ];
    });
    setState((prev) => ({ ...prev, pendingItemQueue: [], pendingItem: null }));
    audioService.playSound('item');
  }, [state.pendingItemQueue]);

  /** Mobile: show inventory drawer when a pickup animation runs so the new item is visible in context. */
  useEffect(() => {
    if (!activePickupAnimations.length || !isNarrowMobile || !state.uiVisible) return;
    setMobileLeftOpen(false);
    setMobileRightOpen(true);
  }, [activePickupAnimations.length, isNarrowMobile, state.uiVisible]);

  useEffect(() => {
    loadGame();
  }, []);

  // Keep local avatar in sync if storage changes (multi-tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith('cavern_local_avatar')) return;
      setLocalAvatar(loadLocalAvatar());
      setDraftAvatar(loadLocalAvatar());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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

  // Compute current scene early so hooks remain unconditional (no hooks after early returns).
  const currentScene = SCENES[state.currentSceneId] ?? SCENES.cutscene_intro;

  // Debounced / async-ish autocomplete so typing never blocks on regex scans.
  useEffect(() => {
    const inGameplay =
      state.gameStarted && !state.namingPhase && !state.currentSceneId.startsWith('cutscene_') && state.uiVisible;
    if (!inGameplay || state.isGameOver) {
      setCommandSuggestions([]);
      return;
    }
    const q = inputValue.trimStart();
    if (!q) {
      setCommandSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      const next = getCommandSuggestions({
        input: inputValue,
        scene: currentScene,
        state: {
          inventory: state.inventory,
          equippedItemIds: state.equippedItemIds,
          currentSceneId: state.currentSceneId,
          hasMap: state.hasMap,
        } as any,
      });
      startTransition(() => setCommandSuggestions(next));
    }, 320);
    return () => window.clearTimeout(t);
  }, [
    inputValue,
    currentScene,
    state.inventory,
    state.equippedItemIds,
    state.currentSceneId,
    state.hasMap,
    state.gameStarted,
    state.namingPhase,
    state.currentSceneId,
    state.uiVisible,
    state.isGameOver,
  ]);

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
        if (pendingCutsceneState) {
          setState(pendingCutsceneState);
          setPendingCutsceneState(null);
          setSkipTypewriter(false);
          return;
        }
        setSkipTypewriter(true);
      }
    },
    [pendingCutsceneState, state.history.length],
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

    if (pendingCutsceneState) {
      if (!skipTypewriter && state.history.length > 0) {
        setSkipTypewriter(true);
      }
      return;
    }

    if (!skipTypewriter && state.history.length > 0) {
      setSkipTypewriter(true);
      return;
    }

    const commandToProcess = manualCommand || inputValue;
    if (!commandToProcess.trim()) return;

    audioService.playSound('click');
    const newState = processCommand(state, commandToProcess);
    const enteringCutscene =
      !state.currentSceneId.startsWith('cutscene_') && newState.currentSceneId.startsWith('cutscene_');
    const hasFreshNarrative = newState.history.length > state.history.length;
    if (enteringCutscene && hasFreshNarrative) {
      setPendingCutsceneState(newState);
      setState({
        ...newState,
        currentSceneId: state.currentSceneId,
      });
    } else {
      setPendingCutsceneState(null);
      setState(newState);
    }
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

  const dicebearSeed = [state.playerName, ...(state.equippedItemIds ?? [])].join('|');
  const avatarSrc =
    localAvatar?.kind === 'photo'
      ? localAvatar.dataUrl
      : buildDicebearAvatarUrl(localAvatar?.kind === 'dicebear' ? localAvatar.seed : dicebearSeed, dicebearProfile);

  const draftAvatarSrc =
    draftAvatar?.kind === 'photo'
      ? draftAvatar.dataUrl
      : buildDicebearAvatarUrl(draftAvatar?.kind === 'dicebear' ? draftAvatar.seed : dicebearSeed, dicebearProfile);

  const handlePickRandomAvatarDraft = () => {
    const seed = `${state.playerName}-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;
    const next = { kind: 'dicebear' as const, seed };
    setDraftAvatar(next);
  };

  const handleUsePhotoAvatarDraft = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image.'));
      });
      const dataUrl = await imageToPixelAvatarDataUrl({ image: img, pixelSize: 32, outputSize: 128, posterizeLevels: 6 });
      const next = { kind: 'photo' as const, dataUrl };
      setDraftAvatar(next);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const applyDraftAvatar = () => {
    if (!draftAvatar) {
      clearLocalAvatar();
      setLocalAvatar(null);
      return;
    }
    saveLocalAvatar(draftAvatar);
    setLocalAvatar(draftAvatar);
  };

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
          helpBody={getHelpText(currentScene)}
        />
      )}
    </>
  );

  const loadModal = (
    <LoadGameModal
      isOpen={isLoadModalOpen}
      slots={saveSlots}
      dicebearProfile={dicebearProfile}
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

  const { gear: equippedGear, weapons: equippedWeapons } = deriveEquippedSlots(state);
  const showEquippedHud = hasAnyEquippableItem(state);
  const showHeadSlot = hasAnyHeadItem(state);
  const showWeaponSlots = hasAnyWeaponItem(state);
  const showHandsSlot = hasAnyHandsItem(state);
  const slotHasAvailableGear = {
    head: state.inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === 'head';
    }),
    torso: state.inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === 'torso';
    }),
    hands: state.inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === 'hands';
    }),
    legs: state.inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === 'legs';
    }),
    feet: state.inventory.some((id) => {
      const it = ITEMS[id];
      if (!it) return false;
      const t = it.itemType ?? (it.equippable ? 'gear' : 'misc');
      return t === 'gear' && (it.gearSlot ?? it.equipmentSlot) === 'feet';
    }),
  };
  const equippedModal = (
    <EquippedStatusModal
      isOpen={isEquippedModalOpen}
      onClose={() => setIsEquippedModalOpen(false)}
      gear={equippedGear}
      weapons={equippedWeapons}
      inventory={state.inventory}
      equippedItemIds={state.equippedItemIds ?? []}
      onEquipItem={(itemId) => setState((prev) => equipItemFromInventory(prev, itemId))}
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

  const mainFooter = (
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

        </div>
        {infoModal}
        {loadModal}
        {equippedModal}
        {settingsModal}
        <div className="fixed inset-x-0 bottom-0 z-50">{mainFooter}</div>
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
        {equippedModal}
        {settingsModal}
        <div className="fixed inset-x-0 bottom-0 z-50">{mainFooter}</div>
      </>
    );
  }

  const deadlineSecondsLeft =
    state.deadlineAtMs && !state.isGameOver && state.currentSceneId === state.deadlineSceneId
      ? Math.max(0, Math.ceil((state.deadlineAtMs - Date.now()) / 1000))
      : null;
  const interactionLabels = getSceneInteractionLabels(currentScene);
  const sceneObjectRows = getSceneObjectRows(currentScene);
  const awaitingPromptResponse = isActivePendingPrompt(state.pendingPrompt);
  const focusedGlowLabel = getFocusedGlowLabel(state);
  const suggestionActiveIndex =
    suggestionHighlight >= 0 && suggestionHighlight < commandSuggestions.length ? suggestionHighlight : -1;

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (state.isGameOver) return;
    const suggestions = commandSuggestions;

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
                scene={currentScene}
                gameChromeVisible={state.uiVisible}
                onChoice={(choice) => handleCommand(undefined, choice)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activePickupAnimations.map((anim) => (
              <React.Fragment key={anim.key}>
                <InventoryAnimation
                  itemId={anim.id}
                  itemName={ITEMS[anim.id].name}
                  iconName={ITEMS[anim.id].icon}
                  target={anim.target}
                  startDelayMs={anim.startDelayMs}
                  onComplete={() => setActivePickupAnimations((prev) => prev.filter((x) => x.key !== anim.key))}
                />
              </React.Fragment>
            ))}
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
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={() => {
                        setDraftAvatar(localAvatar);
                        setIsAvatarModalOpen(true);
                      }}
                      className="flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-[#ffaaf6] bg-[#353535] hover:border-[#35ebeb]"
                      aria-label="Change avatar"
                    >
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    </button>
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
                  {showEquippedHud && (
                    <div
                      className={clsx(
                        'mt-3 grid w-full gap-1',
                        showWeaponSlots
                          ? showHeadSlot
                            ? showHandsSlot
                              ? 'grid-cols-7'
                              : 'grid-cols-6'
                            : showHandsSlot
                              ? 'grid-cols-6'
                              : 'grid-cols-5'
                          : showHeadSlot
                            ? showHandsSlot
                              ? 'grid-cols-5'
                              : 'grid-cols-4'
                            : showHandsSlot
                              ? 'grid-cols-4'
                              : 'grid-cols-3',
                      )}
                    >
                      {[
                        ...(showHeadSlot
                          ? [
                              {
                                k: 'head',
                                Icon: HardHat,
                                on: Boolean(equippedGear.head),
                                label: 'Head',
                                alert: !equippedGear.head && slotHasAvailableGear.head,
                              },
                            ]
                          : []),
                        {
                          k: 'torso',
                          Icon: Shirt,
                          on: Boolean(equippedGear.torso),
                          label: 'Torso',
                          alert: !equippedGear.torso && slotHasAvailableGear.torso,
                        },
                        ...(showHandsSlot
                          ? [
                              {
                                k: 'hands',
                                Icon: Hand,
                                on: Boolean(equippedGear.hands),
                                label: 'Hands',
                                alert: !equippedGear.hands && slotHasAvailableGear.hands,
                              },
                            ]
                          : []),
                        {
                          k: 'legs',
                          Icon: PersonStanding,
                          on: Boolean(equippedGear.legs),
                          label: 'Legs',
                          alert: !equippedGear.legs && slotHasAvailableGear.legs,
                        },
                        {
                          k: 'feet',
                          Icon: Footprints,
                          on: Boolean(equippedGear.feet),
                          label: 'Feet',
                          alert: !equippedGear.feet && slotHasAvailableGear.feet,
                        },
                        ...(showWeaponSlots
                          ? [
                              { k: 'left', Icon: Sword, on: Boolean(equippedWeapons.left), label: 'Left hand', alert: false },
                              { k: 'right', Icon: Sword, on: Boolean(equippedWeapons.right), label: 'Right hand', alert: false },
                            ]
                          : []),
                      ].map(({ k, Icon, on, label, alert }) => (
                        <button
                          key={k}
                          type="button"
                          onMouseEnter={hoverUi}
                          onClick={() => setIsEquippedModalOpen(true)}
                          className={clsx(
                            'flex h-9 items-center justify-center border bg-[#131313] text-[#35ebeb] hover:bg-[#353535]/40',
                            alert ? 'border-[#35ebeb]' : 'border-[#353535]',
                          )}
                          aria-label={`View equipped (${label})`}
                        >
                          <Icon size={16} className={on ? 'opacity-100' : 'opacity-30'} />
                        </button>
                      ))}
                    </div>
                  )}
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
                AREA: {getSceneAreaDisplayLabel(state, state.currentSceneId)}
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
                      }}
                      onKeyDown={handlePromptKeyDown}
                      className="relative z-10 w-full border-none bg-transparent py-0 font-mono text-base font-bold uppercase leading-none tracking-wider text-[#35ebeb] caret-[#35ebeb] placeholder:text-[#35ebeb]/30 focus:ring-0"
                      placeholder={
                        inputValue ? '' : awaitingPromptResponse ? 'ENTER RESPONSE...' : 'ENTER COMMAND...'
                      }
                      disabled={state.isGameOver}
                    />
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
                        <ChevronDown size={16} className={clsx('transition-transform', !inventoryPanelExpanded && '-rotate-90')} />
                      </span>
                    </button>
                    {inventoryPanelExpanded && (
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain">
                        {state.inventory.filter((id) => {
                          const it = ITEMS[id];
                          const t = it?.itemType ?? (it?.equippable ? 'gear' : 'misc');
                          return t === 'misc';
                        }).length > 0 ? (
                          <AnimatePresence initial={false}>
                            {state.inventory
                              .filter((id) => {
                                const it = ITEMS[id];
                                const t = it?.itemType ?? (it?.equippable ? 'gear' : 'misc');
                                return t === 'misc';
                              })
                              .map((id) => {
                                const iconKey = ITEMS[id].icon as keyof typeof LucideIcons | undefined;
                                const Icon =
                                  (iconKey && (LucideIcons as any)[iconKey]
                                    ? ((LucideIcons as any)[iconKey] as React.ComponentType<{ size?: number }>)
                                    : (LucideIcons.Package as React.ComponentType<{ size?: number }>));
                                return (
                                  <motion.button
                                    layout
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }}
                                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                                    type="button"
                                    key={id}
                                    onMouseEnter={hoverUi}
                                    onClick={() => handleCommand(undefined, `examine ${ITEMS[id].name}`)}
                                    className="group flex w-full items-center gap-3 border-l-4 border-[#35ebeb] bg-[#131313] p-3 text-left transition-all hover:bg-[#353535]"
                                  >
                                    <div className="text-[#35ebeb]">
                                      <Icon size={16} />
                                    </div>
                                    <div className="text-sm font-bold uppercase text-[#ffffff]">{ITEMS[id].name}</div>
                                  </motion.button>
                                );
                              })}
                          </AnimatePresence>
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
                        <span className="flex min-w-0 items-center gap-2 font-black uppercase tracking-widest text-[#ffaaf6]">
                          <Boxes size={18} /> SCENE OBJECTS
                        </span>
                        <span className="shrink-0 font-mono text-xs font-black text-[#35ebeb]">
                          <ChevronDown size={16} className={clsx('transition-transform', !sceneObjectsPanelExpanded && '-rotate-90')} />
                        </span>
                      </button>
                      {sceneObjectsPanelExpanded && (
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain">
                          {sceneObjectRows.map(({ id, name, Icon }) => (
                            <button
                              type="button"
                              key={id}
                              onMouseEnter={hoverUi}
                              onClick={() => handleCommand(undefined, `examine ${id.replace(/_/g, ' ')}`)}
                              className="group flex w-full items-center gap-3 border-l-4 border-[#353535] bg-[#0f0f0f] p-3 text-left transition-all hover:bg-[#202020]"
                            >
                              <div className="text-[#e2e2e2]/60">
                                <Icon size={16} />
                              </div>
                              <div className="text-sm font-bold uppercase text-[#e2e2e2]/90">{name}</div>
                            </button>
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
        {equippedModal}
        <AvatarPickerModal
          isOpen={isAvatarModalOpen}
          onClose={() => {
            setDraftAvatar(localAvatar);
            setIsAvatarModalOpen(false);
          }}
          currentAvatarSrc={avatarSrc}
          draftAvatarSrc={draftAvatarSrc}
          isDirty={JSON.stringify(draftAvatar) !== JSON.stringify(localAvatar)}
          onPickRandom={handlePickRandomAvatarDraft}
          onUsePhoto={handleUsePhotoAvatarDraft}
          onClearCustom={() => setDraftAvatar(null)}
          onApply={() => {
            applyDraftAvatar();
            setIsAvatarModalOpen(false);
          }}
          dicebearProfile={dicebearProfile}
          onDicebearProfileChange={(profile) => {
            setDicebearProfile(profile);
            saveDicebearProfile(profile);
          }}
          hasCustomAvatar={localAvatar?.kind === 'photo'}
        />

        {mainFooter}
      </div>
      {infoModal}
      {loadModal}
    </>
  );
}
