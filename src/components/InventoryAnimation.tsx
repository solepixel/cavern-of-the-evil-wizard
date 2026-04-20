import React from 'react';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';

interface InventoryAnimationProps {
  itemName: string;
  iconName?: string;
  onComplete: () => void;
}

export default function InventoryAnimation({ itemName, iconName, onComplete }: InventoryAnimationProps) {
  const Resolved =
    iconName && iconName in LucideIcons
      ? (LucideIcons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName]
      : undefined;
  const Icon = typeof Resolved === 'function' ? Resolved : LucideIcons.Package;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[120] pointer-events-none"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.55, 0] }}
        transition={{ duration: 1.7, times: [0, 0.2, 0.75, 1], ease: 'easeInOut' }}
        className="absolute inset-0 bg-black"
      />

      <motion.div
        initial={{ scale: 0.6, opacity: 0, x: '-50%', y: '45vh', left: '50%', top: '50%' }}
        animate={{
          scale: [0.6, 1.15, 1.05, 0.9],
          opacity: [0, 1, 1, 0],
          x: ['-50%', '-50%', '36vw', '40vw'],
          y: ['45vh', '0vh', '0vh', '0vh'],
        }}
        transition={{
          duration: 1.7,
          times: [0, 0.25, 0.75, 1],
          ease: [0.22, 0.99, 0.36, 1],
        }}
        onAnimationComplete={onComplete}
        className="absolute flex flex-col items-center gap-3"
      >
        <div className="relative border-4 border-[#ffaaf6] bg-[#131313] p-7 shadow-[0_0_60px_rgba(255,170,246,0.55)]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-[#ffaaf6]/10"
          />
          <Icon size={76} className="relative z-10 text-[#ffaaf6]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, 0] }}
          transition={{ duration: 1.7, times: [0, 0.25, 0.75, 1], ease: 'easeOut' }}
          className="bg-[#ffaaf6] px-5 py-2 text-xl font-black uppercase tracking-[0.2em] text-[#131313] shadow-xl"
        >
          {itemName} ACQUIRED
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
