import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export type InfoModalKind = 'reboot' | 'log' | 'help';

const COPY: Record<InfoModalKind, { title: string; body: string }> = {
  reboot: {
    title: 'SYSTEM_REBOOT',
    body: 'Restarting the terminal session will return you to the title screen. This control will be wired to a full reboot flow in a future update.',
  },
  log: {
    title: 'DATA_LOG',
    body: 'The data log will list story beats, discovered lore, and system diagnostics. Configuration is not hooked up yet—check back later.',
  },
  help: {
    title: 'HELP',
    body: 'Type commands in the terminal (e.g. LOOK, OPEN WARDROBE, GO NORTH, TAKE MAP). The sidebar and settings offer shortcuts and audio controls. Full documentation will land here later.',
  },
};

interface InfoModalProps {
  kind: InfoModalKind | null;
  onClose: () => void;
}

export default function InfoModal({ kind, onClose }: InfoModalProps) {
  if (!kind) return null;
  const content = COPY[kind];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md border-4 border-[#35ebeb] bg-[#1b1b1b] p-8"
      >
        <div className="absolute -left-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -right-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#35ebeb]" />

        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-xl font-black uppercase tracking-widest text-[#ffaaf6]">{content.title}</h2>
          <button type="button" onClick={onClose} className="text-[#35ebeb] hover:text-white" aria-label="Close">
            <X size={24} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[#e2e2e2]/90">{content.body}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full border-2 border-[#35ebeb] py-3 text-xs font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
        >
          ACKNOWLEDGE
        </button>
      </motion.div>
    </div>
  );
}
