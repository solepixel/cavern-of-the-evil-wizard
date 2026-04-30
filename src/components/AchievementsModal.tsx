import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { ACHIEVEMENTS } from '../lib/achievements';
import { audioService } from '../lib/audioService';
import { resolveIconComponent } from '../lib/iconRegistry';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievementLevels: Record<string, number>;
}

export default function AchievementsModal({ isOpen, onClose, achievementLevels }: AchievementsModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();
  const unlocked = Object.entries(achievementLevels)
    .filter(([, level]) => (level ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-210 flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            className="relative z-10 my-2 w-full max-h-[calc(100dvh-2rem)] max-w-2xl overflow-x-hidden overflow-y-auto border-4 border-accent-cyan bg-bg-panel p-6 sm:my-0 sm:p-8"
          >
            <div className="absolute -left-1 -top-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -right-1 -top-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-accent-cyan" />

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-accent-magenta">Achievements</h2>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-accent-cyan/70">Badges earned during this run</p>
              </div>
              <button type="button" onMouseEnter={hoverUi} onClick={onClose} className="text-accent-cyan hover:text-white" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            {unlocked.length === 0 ? (
              <div className="rounded border border-border-base bg-bg-base p-6 text-center text-sm text-text-primary/75">
                No achievements yet. Keep exploring.
              </div>
            ) : (
              <div className="space-y-2">
                {unlocked.map(([id, level]) => {
                  const def = ACHIEVEMENTS[id];
                  const Icon = resolveIconComponent(def?.icon ?? 'Sparkles') as React.ComponentType<{ size?: number; className?: string }>;
                  return (
                    <div key={id} className="flex items-start gap-3 border-l-4 border-accent-cyan bg-bg-base p-3">
                      <div className="mt-1 text-accent-cyan">
                        <Icon size={18} className="text-accent-cyan" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-black uppercase text-white">{def?.name ?? id}</div>
                          <div className="shrink-0 text-[10px] font-black uppercase tracking-widest text-accent-magenta">
                            {def?.stackable ? `x${level}` : 'Unlocked'}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-text-primary/75">{def?.description ?? 'Unknown achievement.'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 rounded border border-border-base bg-bg-base p-3 text-xs text-text-primary/75">
              <div className="flex items-center gap-2 font-black uppercase tracking-widest text-accent-cyan">
                <Sparkles size={14} /> Total Unlocked: {unlocked.length}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
