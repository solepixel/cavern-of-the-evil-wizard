import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Scene } from '../types';

interface CutsceneProps {
  scene: Scene;
  onChoice: (command: string) => void;
}

export default function Cutscene({ scene, onChoice }: CutsceneProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const choices = Object.keys(scene.commands ?? {});

  const handleChoice = (choice: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      onChoice(choice);
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1 } }}
      className="fixed inset-0 bg-black z-[60] overflow-hidden"
    >
      <div className="fixed inset-0 crt-scanlines pointer-events-none opacity-40 z-10" />

      <div className="relative z-20 flex min-h-full flex-col items-center justify-center p-6 md:p-8">
        {/* Comic panel: image lives inside the frame; expands to top half on choice */}
        <motion.div
          layout
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          className={`relative w-full overflow-hidden border-8 border-[#ffffff] shadow-[0_0_50px_rgba(255,255,255,0.2)] ${
            isTransitioning
              ? 'fixed left-0 right-0 top-0 z-[70] h-[50vh]'
              : 'max-w-4xl aspect-[21/9]'
          }`}
        >
          {scene.background && (
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{
                filter: isTransitioning
                  ? 'blur(0px) brightness(1)'
                  : 'blur(20px) brightness(0.5)',
                scale: isTransitioning ? 1 : 1.08,
              }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
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

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <motion.div
              animate={{ opacity: isTransitioning ? 0 : 1 }}
              transition={{ duration: 0.5 }}
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
        </motion.div>

        <motion.div
          className="mt-8 flex w-full max-w-4xl flex-col gap-8"
          animate={{
            opacity: isTransitioning ? 0 : 1,
            height: isTransitioning ? 0 : 'auto',
            marginTop: isTransitioning ? 0 : undefined,
          }}
          transition={{ duration: 0.4 }}
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isTransitioning ? 0.35 : 0 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute inset-0 z-[65] bg-black"
      />
    </motion.div>
  );
}
