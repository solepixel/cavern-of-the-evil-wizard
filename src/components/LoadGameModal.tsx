import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { SaveSlotSummary } from '../lib/gameEngine';
import { SCENES } from '../gameData';

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ms);
  }
}

interface LoadGameModalProps {
  isOpen: boolean;
  slots: SaveSlotSummary[];
  onClose: () => void;
  onLoad: (slotId: string) => void;
}

export default function LoadGameModal({ isOpen, slots, onClose, onLoad }: LoadGameModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            className="relative z-10 w-full max-w-lg border-4 border-[#35ebeb] bg-[#1b1b1b] p-8"
          >
            <div className="absolute -left-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -right-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#35ebeb]" />

            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-xl font-black uppercase tracking-widest text-[#ffaaf6]">LOAD GAME</h2>
              <button type="button" onClick={onClose} className="text-[#35ebeb] hover:text-white" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {slots.length === 0 ? (
                <div className="border-l-4 border-[#353535] bg-[#131313] p-4 text-sm text-[#e2e2e2]/70">
                  No save slots found yet.
                </div>
              ) : (
                slots.map((s) => {
                  const sceneTitle = SCENES[s.sceneId]?.title ?? s.sceneId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onLoad(s.id)}
                      className="w-full border-l-4 border-[#35ebeb] bg-[#131313] p-4 text-left transition-all hover:bg-[#353535]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-black uppercase tracking-wider text-white">{s.playerName || 'PLAYER'}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#35ebeb]/80">{formatDate(s.savedAt)}</div>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-widest text-[#e2e2e2]/70">
                        {sceneTitle.replace('{{name}}', s.playerName)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full border-2 border-[#35ebeb] py-3 text-xs font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
            >
              CANCEL
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

