/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Backpack, Map as MapIcon, Save, Settings as CogIcon, Play, AlertTriangle, Volume2, VolumeX, Volume1 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { GameState, Scene } from './types';
import { INITIAL_STATE, SCENES, ITEMS, OBJECTS } from './gameData';
import { processCommand, loadGame, saveGame, SYS_PREFIX, sysLine } from './lib/gameEngine';
import NamingScreen from './components/NamingScreen';
import Cutscene from './components/Cutscene';
import Typewriter from './components/Typewriter';
import InventoryAnimation from './components/InventoryAnimation';
import SettingsModal from './components/SettingsModal';
import InfoModal, { InfoModalKind } from './components/InfoModal';
import { audioService } from './lib/audioService';

function getSceneInteractionLabels(scene: Scene): string[] {
  if (scene.interactionLabels?.length) return scene.interactionLabels;
  return scene.objects.map((oid) => {
    const o = OBJECTS[oid];
    return (o?.name ?? oid).toUpperCase();
  });
}

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [inputValue, setInputValue] = useState('');
  const [skipTypewriter, setSkipTypewriter] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [infoModalKind, setInfoModalKind] = useState<InfoModalKind | null>(null);
  const [sceneInteractionsVisible, setSceneInteractionsVisible] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const scrollTerminalToEnd = useCallback(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (state.gameStarted && !isMuted) {
      audioService.playAmbient();
    }
  }, [state.gameStarted, isMuted]);

  useEffect(() => {
    if (state.pendingItem) {
      audioService.playSound('item');
    }
  }, [state.pendingItem]);

  useEffect(() => {
    loadGame();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.history]);

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
      saveGame(prev);
      return { ...prev, history: [...prev.history, sysLine('System state saved to floppy disk.')] };
    });
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
    setInputValue('');
    setSkipTypewriter(false);

    setVolume(audioService.getVolume());
  };

  const startGame = () => {
    if (!isMuted) {
      audioService.playAmbient();
    }
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

  const toggleMute = () => {
    const muted = audioService.toggleMute();
    setIsMuted(muted);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioService.setVolume(newVol);
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to restart? All progress will be lost.')) {
      setState(INITIAL_STATE);
      localStorage.removeItem('cavern_evil_wizard_save');
      audioService.stopAmbient();
    }
  };

  const infoModal = <InfoModal kind={infoModalKind} onClose={() => setInfoModalKind(null)} />;

  if (!state.gameStarted && !state.namingPhase) {
    return (
      <>
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#131313] p-4">
          <div className="pointer-events-none fixed inset-0 opacity-30 crt-scanlines" />

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
                  onClick={startGame}
                  className="group flex w-full items-center justify-between bg-[#ffffff] px-6 py-4 font-bold uppercase tracking-widest text-[#002020] transition-all hover:bg-[#35ebeb]"
                >
                  <span>START GAME</span>
                  <Play className="opacity-0 transition-opacity group-hover:opacity-100" size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const saved = loadGame();
                    if (saved) {
                      if (!isMuted) audioService.playAmbient();
                      setState(saved);
                    } else {
                      alert('No saved game found.');
                    }
                  }}
                  className="group flex w-full items-center justify-between border-2 border-[#ffaaf6] px-6 py-4 font-bold uppercase tracking-widest text-[#ffaaf6] transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                >
                  <span>LOAD GAME</span>
                  <Save className="opacity-0 transition-opacity group-hover:opacity-100" size={20} />
                </button>
              </div>
            </div>
          </motion.div>

          <footer className="fixed bottom-0 flex w-full items-center justify-between border-t-4 border-[#ffffff] bg-[#131313] p-4 text-[10px] uppercase tracking-widest text-[#ffaaf6]">
            <div>(C) 1988 SENTIENT TERMINAL SYSTEMS</div>
            <div className="flex gap-8">
              <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('reboot')}>
                SYSTEM_REBOOT
              </button>
              <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('log')}>
                DATA_LOG
              </button>
              <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('help')}>
                HELP
              </button>
            </div>
          </footer>
        </div>
        {infoModal}
      </>
    );
  }

  if (state.namingPhase) {
    return (
      <>
        <NamingScreen onComplete={completeNaming} />
        {infoModal}
      </>
    );
  }

  const currentScene = SCENES[state.currentSceneId];
  const isCutscene = state.currentSceneId.startsWith('cutscene_');
  const interactionLabels = getSceneInteractionLabels(currentScene);

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden bg-[#131313] font-sans text-[#e2e2e2]">
        <div className="pointer-events-none fixed inset-0 opacity-20 crt-scanlines" />

        <AnimatePresence>
          {isCutscene && <Cutscene scene={currentScene} onChoice={(choice) => handleCommand(undefined, choice)} />}
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

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveProgress}
          onReset={resetGame}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />

        <div className="flex flex-1 overflow-hidden">
          <AnimatePresence>
            {state.uiVisible && (
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="z-40 flex w-64 flex-col border-r-4 border-[#353535] bg-[#1b1b1b]"
              >
                <div className="border-b-4 border-[#353535] p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-[#ffaaf6] bg-[#353535]">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${state.playerName}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-lg font-bold uppercase tracking-tighter text-[#ffaaf6]">{state.playerName}</div>
                      <div className="text-[10px] font-black text-[#35ebeb]">
                        HP: {state.hp}/{state.maxHp}
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
                    onClick={() => setSceneInteractionsVisible((v) => !v)}
                    className="flex w-full items-center gap-4 bg-[#ffffff] p-4 text-sm font-black uppercase tracking-tighter text-[#002020]"
                  >
                    <Heart size={20} /> STATUS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCommand(undefined, 'view inventory')}
                    className="flex w-full items-center gap-4 p-4 text-sm uppercase tracking-tighter text-[#35ebeb] opacity-70 transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                  >
                    <Backpack size={20} /> INVENTORY
                  </button>
                  {state.hasMap && (
                    <button
                      type="button"
                      onClick={() => handleCommand(undefined, 'view map')}
                      className="flex w-full items-center gap-4 p-4 text-sm uppercase tracking-tighter text-[#35ebeb] opacity-70 transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
                    >
                      <MapIcon size={20} /> MAP
                    </button>
                  )}
                </nav>

                <div className="mt-auto p-6">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex w-full items-center justify-center gap-2 border-2 border-[#35ebeb] py-3 text-xs font-black uppercase text-[#35ebeb] transition-all hover:bg-[#35ebeb] hover:text-[#002020]"
                  >
                    <CogIcon size={18} /> SETTINGS
                  </button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          <main className="flex flex-1 flex-col overflow-hidden bg-[#131313]">
            <section className="group relative h-[50%] overflow-hidden border-b-4 border-[#353535] bg-black">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.currentSceneId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                >
                  {currentScene.image ? (
                    <img
                      src={currentScene.image}
                      alt={currentScene.title}
                      className="h-full w-full object-cover opacity-80"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                      <div className="text-center font-mono text-[#35ebeb]">
                        <div className="mb-4 text-4xl">[ VISUAL FEED ]</div>
                        <div className="text-xl uppercase tracking-widest">
                          {currentScene.title.replace('{{name}}', state.playerName)}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-20" />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />

              <div className="absolute right-4 top-4 border-l-4 border-[#35ebeb] bg-[#1b1b1b] px-3 py-1 text-[10px] font-bold uppercase text-[#35ebeb]">
                AREA: 0x{state.currentSceneId.toUpperCase()}
              </div>

              {state.isGameOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/50">
                  <AlertTriangle className="mb-4 animate-pulse text-white" size={64} />
                  <h2 className="mb-8 text-6xl font-black tracking-widest text-white">GAME OVER</h2>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.lastCheckpoint) setState(state.lastCheckpoint);
                      else setState(INITIAL_STATE);
                    }}
                    className="bg-white px-8 py-4 font-black uppercase tracking-widest text-red-900 transition-all hover:bg-[#35ebeb]"
                  >
                    RELOAD LAST CHECKPOINT
                  </button>
                </div>
              )}
            </section>

            <section className="flex flex-1 flex-col overflow-hidden p-6" onClick={() => setSkipTypewriter(true)}>
              <div className="terminal-scroll mb-4 flex-1 space-y-4 overflow-y-auto pr-4 font-mono">
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

              <form onSubmit={handleCommand} className="relative flex items-center gap-4 border-l-4 border-[#35ebeb] bg-[#1b1b1b] p-4">
                <span className="text-xl font-black tracking-widest text-[#35ebeb]">&gt;</span>
                <div className="relative flex flex-1 items-center">
                  <input
                    autoFocus
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full border-none bg-transparent font-mono text-base font-bold uppercase tracking-wider text-[#35ebeb] caret-[#35ebeb] placeholder:text-[#35ebeb]/30 focus:ring-0"
                    placeholder={inputValue ? '' : 'ENTER COMMAND...'}
                    disabled={state.isGameOver}
                  />
                </div>
                {!state.uiVisible && (
                  <div className="hidden animate-pulse text-[10px] uppercase tracking-widest text-[#35ebeb]/50 md:block">
                    Try: &quot;look&quot;, &quot;open wardrobe&quot;, &quot;take key&quot;
                  </div>
                )}
              </form>
            </section>
          </main>

          <AnimatePresence>
            {state.uiVisible && (
              <motion.aside
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="z-40 flex min-h-0 w-80 flex-col border-l-4 border-[#353535] bg-[#1b1b1b] p-0"
              >
                {sceneInteractionsVisible && (
                  <div className="flex-shrink-0 border-b border-[#353535] p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-black uppercase tracking-widest text-[#35ebeb]">
                      SCENE
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {interactionLabels.map((label) => (
                        <li
                          key={label}
                          className="border border-[#35ebeb]/40 bg-[#131313] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#e2e2e2]"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                  <h3 className="mb-4 flex flex-shrink-0 items-center gap-2 font-black uppercase tracking-widest text-[#ffaaf6]">
                    <Backpack size={18} /> INVENTORY
                  </h3>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {state.inventory.length > 0 ? (
                      state.inventory.map((id) => {
                        // @ts-expect-error dynamic icon
                        const Icon = ITEMS[id].icon ? LucideIcons[ITEMS[id].icon] : LucideIcons.Package;
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
                </div>

                <div className="mt-auto flex-shrink-0 border-t border-[#353535] p-6 pt-4">
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

        <footer className="z-50 flex items-center justify-between border-t-4 border-[#ffffff] bg-[#131313] px-8 py-2 text-[10px] uppercase tracking-widest text-[#ffaaf6]">
          <div>(C) 1988 SENTIENT TERMINAL SYSTEMS</div>
          <div className="flex items-center gap-8">
            <div className="group flex items-center gap-2">
              <button type="button" onClick={toggleMute} className="hover:text-[#35ebeb]">
                {isMuted ? <VolumeX size={14} /> : volume > 0.5 ? <Volume2 size={14} /> : <Volume1 size={14} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="h-1 w-16 cursor-pointer appearance-none bg-[#353535] accent-[#35ebeb] group-hover:bg-[#35ebeb]/30"
              />
            </div>
            <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('reboot')}>
              SYSTEM_REBOOT
            </button>
            <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('log')}>
              DATA_LOG
            </button>
            <button type="button" className="hover:text-[#35ebeb]" onClick={() => setInfoModalKind('help')}>
              HELP
            </button>
          </div>
        </footer>
      </div>
      {infoModal}
    </>
  );
}
