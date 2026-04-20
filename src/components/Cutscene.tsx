import React, { useState } from 'react';
import clsx from 'clsx';
import { motion, LayoutGroup } from 'motion/react';
import { Scene } from '../types';
import { audioService } from '../lib/audioService';
import { CUTSCENE_HANDOFF_DELAY_MS, cutsceneEase, cutsceneImageMotion } from '../lib/cutsceneTransition';

/** When side panels are shown (`App` `uiVisible`): match main column between `w-64` / `w-80` rails. */
const HANDOFF_VIEWPORT_CHROMED =
  'max-lg:inset-x-0 lg:left-64 lg:right-80 lg:w-auto';

/** When chrome is hidden (e.g. intro): main is full width — handoff must not inset for absent sidebars. */
const HANDOFF_VIEWPORT_FULL = 'inset-x-0';

interface CutsceneProps {
  scene: Scene;
  /** When false, left/right game panels are hidden — use full-width handoff to match the main viewport. */
  gameChromeVisible: boolean;
  onChoice: (command: string) => void;
}

export default function Cutscene({ scene, onChoice, gameChromeVisible }: CutsceneProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const choices = Object.keys(scene.commands ?? {});
  const hoverUi = () => audioService.playHoverThrottled();

  const visualSrc = scene.background ?? scene.image;
  const handoffLayoutId = scene.viewportHandoffLayoutId;

  const handleChoice = (choice: string, index: number) => {
    setSelectedChoiceIndex(index);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={clsx(
        'fixed inset-0 z-[60] overflow-hidden bg-transparent',
        isTransitioning && 'pointer-events-none',
      )}
    >
      {/* Darken idle gameplay beneath; peel away during handoff so terminal can read as “over” the scene */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-[5] bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: isTransitioning ? 0 : 1 }}
        transition={{ duration: 0.5, ease: copyEase }}
      />
      <div className="pointer-events-none fixed inset-0 z-10 opacity-40 crt-scanlines" />

      <LayoutGroup>
        <div
          className={`relative z-20 flex min-h-full flex-col ${
            isTransitioning ? 'px-0 py-0' : 'justify-center px-4 py-6 md:px-8'
          } ${isTransitioning ? 'justify-between' : ''}`}
        >
          {/* PANEL_01 — `layoutId` must live on this bordered node so the shell isn’t left at z-[70] after the image flies to gameplay. */}
          <motion.div
            layout={false}
            layoutId={handoffLayoutId}
            initial={false}
            animate={{
              filter: isTransitioning ? 'blur(0px) brightness(1)' : `blur(${blurIdlePx}px) brightness(0.52)`,
              scale: isTransitioning ? 1 : scaleIdle,
            }}
            transition={{
              layout: { type: 'spring', stiffness: 260, damping: 32, mass: 0.85 },
              filter: { duration: blurClearSec, ease: imageEase },
              scale: { duration: blurClearSec, ease: imageEase },
            }}
            className={clsx(
              'relative z-[70] overflow-hidden border-8 border-[#ffffff] shadow-[0_0_50px_rgba(255,255,255,0.2)]',
              isTransitioning
                ? ['fixed top-0 z-[75] h-[50svh] max-w-none rounded-none', handoffHorizontal]
                : 'mx-auto aspect-[21/9] w-full max-w-4xl rounded-sm',
            )}
          >
            {visualSrc ? (
              <img src={visualSrc} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="absolute inset-0 bg-[#1b1b1b]/90 backdrop-blur-sm" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/35" />

            <div className="relative z-10 flex h-full min-h-[8rem] items-center justify-center px-4 md:px-8">
              <motion.div
                animate={{
                  opacity: isTransitioning ? 0 : 1,
                  y: isTransitioning ? -10 : 0,
                }}
                transition={{ duration: 0.42, ease: copyEase }}
                className="text-center text-2xl font-black uppercase leading-tight tracking-widest text-[#ffaaf6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-4xl"
              >
                {scene.title}
              </motion.div>
            </div>

            <motion.div
              className="absolute left-0 top-0 z-20 bg-[#ffffff] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]"
              animate={{ opacity: isTransitioning ? 0 : 1, x: isTransitioning ? -8 : 0 }}
              transition={{ duration: 0.38, ease: copyEase }}
            >
              PANEL_01 // DECISION_POINT
            </motion.div>
            <motion.div
              className="absolute bottom-0 right-0 z-20 bg-[#35ebeb] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]"
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
            <div className="border-l-8 border-[#35ebeb] bg-[#ffffff] p-6 text-[#000000] shadow-lg">
              <p className="text-xl font-bold leading-relaxed">{scene.description}</p>
            </div>
          </motion.div>

          {/* Choices: selected row grows into lower half; label + command copy fade */}
          <div
            className={`mx-auto mt-8 grid w-full max-w-4xl gap-4 ${
              isTransitioning ? 'min-h-0 flex-1 grid-cols-1 pb-0' : 'grid-cols-1 md:grid-cols-2'
            }`}
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
                  disabled={isTransitioning}
                  className={`group relative border-4 border-[#35ebeb] bg-[#131313] p-6 text-left transition-colors hover:bg-[#35ebeb] hover:text-[#131313] disabled:pointer-events-none ${
                    isSelected
                      ? `fixed bottom-0 top-[50svh] z-[90] flex flex-col justify-center rounded-none border-[#35ebeb] ${handoffHorizontal}`
                      : ''
                  } ${isHiddenSibling ? 'pointer-events-none hidden' : ''}`}
                >
                  <motion.div
                    className="mb-2 text-[10px] font-black uppercase text-[#ffaaf6] group-hover:text-[#131313]"
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
          </div>
        </div>
      </LayoutGroup>
    </motion.div>
  );
}

/** Re-export for cutscene / decision-point scenes that mirror the same handoff timings. */
export { CUTSCENE_HANDOFF_DELAY_MS, cutsceneEase, cutsceneImageMotion } from '../lib/cutsceneTransition';
