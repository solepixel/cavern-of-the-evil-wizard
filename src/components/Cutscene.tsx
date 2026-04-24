import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { motion, LayoutGroup } from 'motion/react';
import { Scene } from '../types';
import { audioService } from '../lib/audioService';
import { CUTSCENE_HANDOFF_DELAY_MS, cutsceneEase, cutsceneImageMotion } from '../lib/cutsceneTransition';

/**
 * When side panels are shown (`App` `uiVisible`): match the main column only (same as gameplay viewport).
 * Explicit width avoids `layoutId` + `fixed` measuring full viewport and covering the inventory rail.
 */
const HANDOFF_VIEWPORT_CHROMED =
  'max-lg:inset-x-0 max-lg:w-full lg:left-64 lg:right-auto lg:w-[calc(100vw-16rem-20rem)] lg:max-w-[calc(100vw-16rem-20rem)]';

/** When chrome is hidden (e.g. intro): main is full width — handoff must not inset for absent sidebars. */
const HANDOFF_VIEWPORT_FULL = 'inset-x-0';

interface CutsceneProps {
  scene: Scene;
  /** When false, left/right game panels are hidden — use full-width handoff to match the main viewport. */
  gameChromeVisible: boolean;
  onChoice: (command: string) => void;
  isPanelScene: (sceneId: string) => boolean;
  getPanelOrdinal: (sceneId: string) => number | undefined;
}

export default function Cutscene({ scene, onChoice, gameChromeVisible, isPanelScene, getPanelOrdinal }: CutsceneProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPanelSliding, setIsPanelSliding] = useState(false);
  const [slideOffsetX, setSlideOffsetX] = useState(0);
  const [panelOpacity, setPanelOpacity] = useState(1);
  const [panelJumpMode, setPanelJumpMode] = useState(false);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [typedDescription, setTypedDescription] = useState(scene.description);
  const [typingDone, setTypingDone] = useState(true);
  const choices = Object.keys(scene.commands ?? {});
  const hoverUi = () => audioService.playHoverThrottled();
  const previousWasPanelRef = React.useRef(false);
  const previousSceneIdRef = React.useRef(scene.id);
  const pendingSlideDirectionRef = React.useRef<1 | -1>(1);
  const typewriterTimerRef = React.useRef<number | null>(null);

  const visualSrc = scene.background ?? scene.image;
  const handoffLayoutId = scene.viewportHandoffLayoutId;
  const PANEL_SLIDE_X = 180;
  const PANEL_SLIDE_MS = 280;
  const TYPEWRITER_MS = 16;

  const handleChoice = (choice: string, index: number) => {
    const nextSceneId = scene.commands?.[choice]?.nextScene;
    const shouldSlidePanelToPanel = Boolean(nextSceneId && isPanelScene(nextSceneId));

    setSelectedChoiceIndex(index);
    if (shouldSlidePanelToPanel) {
      const fromOrdinal = getPanelOrdinal(scene.id) ?? 0;
      const toOrdinal = getPanelOrdinal(nextSceneId!) ?? fromOrdinal;
      const direction: 1 | -1 = toOrdinal >= fromOrdinal ? 1 : -1;
      pendingSlideDirectionRef.current = direction;
      setPanelJumpMode(false);
      setIsPanelSliding(true);
      setPanelOpacity(0);
      setSlideOffsetX(-direction * PANEL_SLIDE_X);
      window.setTimeout(() => {
        onChoice(choice);
      }, PANEL_SLIDE_MS);
      return;
    }
    setIsTransitioning(true);
    window.setTimeout(() => {
      onChoice(choice);
    }, CUTSCENE_HANDOFF_DELAY_MS);
  };

  const imageEase = cutsceneEase.image;
  const copyEase = cutsceneEase.copy;
  const { blurIdlePx, blurClearSec, scaleIdle } = cutsceneImageMotion;

  const handoffHorizontal =
    gameChromeVisible ? HANDOFF_VIEWPORT_CHROMED : HANDOFF_VIEWPORT_FULL;

  const borderSettleSec = 0.55;

  // If we chain multiple cutscenes, ensure local transition state resets per scene.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const isPanel = isPanelScene(scene.id);
    const wasPanel = previousWasPanelRef.current;
    const previousSceneId = previousSceneIdRef.current;
    const previousOrdinal = getPanelOrdinal(previousSceneId);
    const currentOrdinal = getPanelOrdinal(scene.id);
    const inferredDirection: 1 | -1 =
      currentOrdinal !== undefined &&
      previousOrdinal !== undefined &&
      currentOrdinal < previousOrdinal
        ? -1
        : 1;
    const direction = pendingSlideDirectionRef.current ?? inferredDirection;
    if (wasPanel && isPanel) {
      setPanelJumpMode(true);
      setSlideOffsetX(direction * PANEL_SLIDE_X);
      setPanelOpacity(0);
      // Two RAFs ensure the incoming start pose is painted before the move starts.
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setPanelJumpMode(false);
          setSlideOffsetX(0);
          setPanelOpacity(1);
        });
      });
    } else {
      setPanelJumpMode(false);
      setSlideOffsetX(0);
      setPanelOpacity(1);
    }
    previousWasPanelRef.current = isPanel;
    previousSceneIdRef.current = scene.id;
    setIsTransitioning(false);
    setIsPanelSliding(false);
    setSelectedChoiceIndex(null);
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [scene.id, isPanelScene, getPanelOrdinal]);

  useEffect(() => {
    if (!isPanelScene(scene.id)) {
      setTypedDescription(scene.description);
      setTypingDone(true);
      return;
    }
    setTypedDescription('');
    setTypingDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTypedDescription(scene.description.slice(0, i));
      if (i >= scene.description.length) {
        window.clearInterval(id);
        typewriterTimerRef.current = null;
        setTypingDone(true);
      }
    }, TYPEWRITER_MS);
    typewriterTimerRef.current = id;
    return () => window.clearInterval(id);
  }, [scene.id, scene.description, isPanelScene]);

  const isAnimatingOut = isTransitioning || isPanelSliding;

  const skipTyping = React.useCallback(() => {
    if (typingDone || isAnimatingOut) return;
    if (typewriterTimerRef.current != null) {
      window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    setTypedDescription(scene.description);
    setTypingDone(true);
  }, [typingDone, isAnimatingOut, scene.description]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: isTransitioning ? 0 : 1,
        x: 0,
      }}
      transition={{ duration: 0.3, ease: copyEase }}
      onPointerDown={skipTyping}
      className={clsx(
        'fixed inset-0 z-60 overflow-hidden bg-transparent',
        isAnimatingOut && 'pointer-events-none',
      )}
    >
      {/* Darken idle gameplay beneath; peel away during handoff so terminal can read as “over” the scene */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-5 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: isTransitioning ? 0 : 1 }}
        transition={{ duration: 0.5, ease: copyEase }}
      />
      <div className="pointer-events-none fixed inset-0 z-10 opacity-40 crt-scanlines" />

      <LayoutGroup>
        <div
          className={`relative z-20 flex min-h-full flex-col ${
            isTransitioning
              ? 'px-0 py-0'
              : 'justify-center px-4 py-6 md:px-8'
          } ${isTransitioning ? 'justify-between' : ''}`}
        >
          {/* `PANEL_NN` from `scene.cutscenePanelOrdinal` — `layoutId` must live on this bordered node so the shell isn’t left at z-[70] after the image flies to gameplay. */}
          <motion.div
            layout={false}
            layoutId={handoffLayoutId}
            initial={false}
            animate={{
              x: slideOffsetX,
              opacity: panelOpacity,
              borderWidth: isTransitioning ? 0 : 8,
              boxShadow: isTransitioning ? '0 0 0 rgba(0,0,0,0)' : '0 0 50px rgba(255,255,255,0.2)',
            }}
            transition={{
              layout: { type: 'spring', stiffness: 260, damping: 32, mass: 0.85 },
              x: panelJumpMode ? { duration: 0 } : { duration: PANEL_SLIDE_MS / 1000, ease: copyEase },
              opacity: panelJumpMode ? { duration: 0 } : { duration: PANEL_SLIDE_MS / 1000, ease: copyEase },
              borderWidth: { duration: borderSettleSec, ease: copyEase },
              boxShadow: { duration: borderSettleSec, ease: copyEase },
            }}
            style={{
              borderStyle: 'solid',
              borderColor: '#ffffff',
            }}
            className={clsx(
              'relative z-70 overflow-hidden',
              isTransitioning
                ? ['fixed top-0 z-75 h-[50svh] max-w-none rounded-none', handoffHorizontal]
                : 'mx-auto aspect-21/9 w-full max-w-4xl rounded-sm',
            )}
          >
            {visualSrc ? (
              <motion.img
                src={visualSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
                initial={false}
                animate={{
                  filter: isTransitioning ? 'blur(0px) brightness(1)' : `blur(${blurIdlePx}px) brightness(0.52)`,
                  scale: isTransitioning ? 1 : scaleIdle,
                }}
                transition={{
                  filter: { duration: blurClearSec, ease: imageEase },
                  scale: { duration: blurClearSec, ease: imageEase },
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-bg-panel/90 backdrop-blur-sm" />
            )}

            <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/35" />

            <div className="relative z-10 flex h-full min-h-32 items-center justify-center px-4 md:px-8">
              <motion.div
                animate={{
                  opacity: isTransitioning ? 0 : 1,
                  y: isTransitioning ? -10 : 0,
                }}
                transition={{ duration: 0.42, ease: copyEase }}
                className="text-center text-2xl font-black uppercase leading-tight tracking-widest text-accent-magenta drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-4xl"
              >
                {scene.title}
              </motion.div>
            </div>

            <motion.div
              className="absolute left-0 top-0 z-20 bg-[#ffffff] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]"
              animate={{ opacity: isTransitioning ? 0 : 1, x: isTransitioning ? -8 : 0 }}
              transition={{ duration: 0.38, ease: copyEase }}
            >
              PANEL_{String(scene.cutscenePanelOrdinal ?? 1).padStart(2, '0')} // DECISION_POINT
            </motion.div>
            <motion.div
              className="absolute bottom-0 right-0 z-20 bg-accent-cyan px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]"
              animate={{ opacity: isTransitioning ? 0 : 1, x: isTransitioning ? 8 : 0 }}
              transition={{ duration: 0.38, ease: copyEase }}
            >
              CHOOSE_YOUR_PATH
            </motion.div>
          </motion.div>

          {/* Middle copy — fades on its own */}
          <motion.div
            className="mx-auto mt-8 w-full max-w-4xl"
            animate={{
              opacity: isTransitioning ? 0 : 1,
              y: isTransitioning ? -6 : 0,
            }}
            transition={{ duration: 0.48, ease: copyEase, delay: isTransitioning ? 0.04 : 0 }}
            style={{ pointerEvents: isTransitioning ? 'none' : 'auto' }}
          >
            <div className="border-l-8 border-accent-cyan bg-[#ffffff] p-6 text-[#000000] shadow-lg">
              <div className="relative">
                {/* Reserve final wrapped height from frame 1 so panel Y stays stable while typing. */}
                <p aria-hidden className="invisible text-xl font-bold leading-relaxed">
                  {scene.description}
                </p>
                <p className="absolute inset-0 text-xl font-bold leading-relaxed">
                  {typedDescription}
                  {!typingDone && <span className="ml-1 inline-block h-5 w-2 animate-pulse bg-[#000000]" />}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Choices: selected row grows into lower half; label + command copy fade */}
          <motion.div
            className={`mx-auto mt-8 grid w-full max-w-4xl gap-4 ${
              isTransitioning ? 'min-h-0 flex-1 grid-cols-1 pb-0' : 'grid-cols-1 md:grid-cols-2'
            }`}
            animate={{
              opacity: typingDone && !isAnimatingOut ? 1 : 0,
              y: typingDone && !isAnimatingOut ? 0 : 6,
            }}
            transition={{ duration: 0.24, ease: copyEase }}
            style={{
              pointerEvents: typingDone && !isAnimatingOut ? 'auto' : 'none',
            }}
          >
            {choices.map((choice, index) => {
              const isSelected = isTransitioning && selectedChoiceIndex === index;
              const isHiddenSibling = isTransitioning && selectedChoiceIndex !== null && selectedChoiceIndex !== index;

              return (
                <motion.button
                  key={choice}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{
                    opacity: isHiddenSibling
                      ? 0
                      : isSelected
                        ? [1, 1, 0]
                        : 1,
                    x: isHiddenSibling ? (index % 2 === 0 ? -12 : 12) : 0,
                    scale: isHiddenSibling ? 0.94 : 1,
                  }}
                  transition={{
                    opacity: isHiddenSibling
                      ? { duration: 0.2, ease: copyEase }
                      : isSelected
                        ? {
                            duration: CUTSCENE_HANDOFF_DELAY_MS / 1000,
                            ease: copyEase,
                            times: [0, 0.5, 1],
                          }
                        : { duration: 0.45, ease: copyEase, delay: 0.5 + index * 0.12 },
                    x: { duration: 0.35, ease: copyEase },
                    scale: { duration: 0.2 },
                  }}
                  onMouseEnter={hoverUi}
                  onClick={() => handleChoice(choice, index)}
                  disabled={isAnimatingOut}
                  className={`group relative border-4 border-accent-cyan bg-bg-base p-6 text-left transition-colors hover:bg-accent-cyan hover:text-bg-base disabled:pointer-events-none ${
                    isSelected
                      ? `fixed bottom-0 top-[50svh] z-90 flex flex-col justify-center rounded-none border-accent-cyan ${handoffHorizontal}`
                      : ''
                  } ${isHiddenSibling ? 'pointer-events-none hidden' : ''}`}
                >
                  <motion.div
                    className="mb-2 text-[10px] font-black uppercase text-accent-magenta group-hover:text-bg-base"
                    animate={{ opacity: isSelected ? 0 : 1 }}
                    transition={{ duration: 0.32, ease: copyEase, delay: isSelected ? 0.18 : 0 }}
                  >
                    OPTION_{index + 1}
                  </motion.div>
                  <motion.div
                    className="text-xl font-black uppercase tracking-widest"
                    animate={{ opacity: isSelected ? 0 : 1 }}
                    transition={{ duration: 0.32, ease: copyEase, delay: isSelected ? 0.22 : 0 }}
                  >
                    {choice}
                  </motion.div>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    &gt;&gt;
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </LayoutGroup>
    </motion.div>
  );
}

/** Re-export for cutscene / decision-point scenes that mirror the same handoff timings. */
export { CUTSCENE_HANDOFF_DELAY_MS, cutsceneEase, cutsceneImageMotion } from '../lib/cutsceneTransition';
