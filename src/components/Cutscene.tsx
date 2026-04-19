import React, { useState } from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { Scene } from '../types';

interface CutsceneProps {
  scene: Scene;
  onChoice: (command: string) => void;
}

const PANEL_TRANSITION_MS = 1400;
const HANDOFF_DELAY_MS = 1450;

export default function Cutscene({ scene, onChoice }: CutsceneProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const choices = Object.keys(scene.commands ?? {});

  const handleChoice = (choice: string) => {
    setIsTransitioning(true);
    window.setTimeout(() => {
      onChoice(choice);
    }, HANDOFF_DELAY_MS);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.85 } }}
      className="fixed inset-0 z-[60] overflow-hidden bg-black"
    >
      <div className="pointer-events-none fixed inset-0 z-10 opacity-40 crt-scanlines" />

      <LayoutGroup>
        <div className="relative z-20 flex min-h-full flex-col items-stretch justify-center px-4 py-6 md:px-8">
          {/* Comic frame + shared image layer (layoutId matches bedroom viewport for handoff) */}
          <div
            className={`relative z-[70] w-full overflow-hidden border-8 border-[#ffffff] shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-[margin] duration-500 ease-out ${
              isTransitioning ? 'fixed left-0 right-0 top-0 z-[75] h-[50vh] max-w-none rounded-none' : 'mx-auto max-w-4xl rounded-sm'
            } ${!isTransitioning ? 'aspect-[21/9]' : ''}`}
            style={isTransitioning ? { marginTop: 0 } : undefined}
          >
            {scene.background && (
              <motion.div
                layoutId="viewport-scene-panel"
                className="absolute inset-0"
                initial={false}
                animate={{
                  filter: isTransitioning ? 'blur(0px) brightness(1)' : 'blur(20px) brightness(0.5)',
                  scale: isTransitioning ? 1 : 1.06,
                }}
                transition={{
                  layout: { type: 'spring', stiffness: 260, damping: 32, mass: 0.85 },
                  filter: { duration: PANEL_TRANSITION_MS / 1000, ease: [0.33, 1, 0.68, 1] },
                  scale: { duration: PANEL_TRANSITION_MS / 1000, ease: [0.33, 1, 0.68, 1] },
                }}
              >
                <img
                  src={scene.background}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            )}

            {!scene.background && (
              <div className="absolute inset-0 bg-[#1b1b1b]/90 backdrop-blur-sm" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/35" />

            <div className="relative z-10 flex h-full min-h-[8rem] items-center justify-center px-4 md:px-8">
              <motion.div
                animate={{ opacity: isTransitioning ? 0 : 1, y: isTransitioning ? -12 : 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="text-center text-2xl font-black uppercase leading-tight tracking-widest text-[#ffaaf6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-4xl"
              >
                {scene.title}
              </motion.div>
            </div>

            <div className="absolute left-0 top-0 z-20 bg-[#ffffff] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]">
              PANEL_01 // DECISION_POINT
            </div>
            <div className="absolute bottom-0 right-0 z-20 bg-[#35ebeb] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#000000]">
              CHOOSE_YOUR_PATH
            </div>
          </div>

          <motion.div
            className="mx-auto mt-8 flex w-full max-w-4xl flex-col gap-8"
            animate={{
              opacity: isTransitioning ? 0 : 1,
              y: isTransitioning ? 16 : 0,
              height: isTransitioning ? 0 : 'auto',
              marginTop: isTransitioning ? 0 : undefined,
            }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', pointerEvents: isTransitioning ? 'none' : 'auto' }}
          >
            <div className="border-l-8 border-[#35ebeb] bg-[#ffffff] p-6 text-[#000000] shadow-lg">
              <p className="text-xl font-bold leading-relaxed">{scene.description}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {choices.map((choice, index) => (
                <motion.button
                  key={choice}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.2 }}
                  onClick={() => handleChoice(choice)}
                  disabled={isTransitioning}
                  className="group relative border-4 border-[#35ebeb] bg-[#131313] p-6 text-left transition-all hover:bg-[#35ebeb] hover:text-[#131313] disabled:opacity-50"
                >
                  <div className="mb-2 text-[10px] font-black uppercase text-[#ffaaf6] group-hover:text-[#131313]">
                    OPTION_{index + 1}
                  </div>
                  <div className="text-xl font-black uppercase tracking-widest">{choice}</div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    &gt;&gt;
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </LayoutGroup>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isTransitioning ? 0.22 : 0 }}
        transition={{ duration: 0.55 }}
        className="pointer-events-none absolute inset-0 z-[65] bg-[#050505]"
      />
    </motion.div>
  );
}
