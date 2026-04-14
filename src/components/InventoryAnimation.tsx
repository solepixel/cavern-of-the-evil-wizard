import React from 'react';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';

interface InventoryAnimationProps {
  itemName: string;
  iconName?: string;
  onComplete: () => void;
}

export default function InventoryAnimation({ itemName, iconName, onComplete }: InventoryAnimationProps) {
  // @ts-ignore
  const Icon = iconName ? LucideIcons[iconName] : LucideIcons.Package;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, x: '-50%', y: '40vh', left: '50%', top: '50%' }}
      animate={{ 
        scale: [0, 1.5, 1.5, 0.5, 0], 
        opacity: [0, 1, 1, 1, 0],
        x: ['-50%', '-50%', '-50%', '35vw', '40vw'], 
        y: ['40vh', '0vh', '0vh', '0vh', '0vh'],
      }}
      transition={{ 
        duration: 2.5,
        times: [0, 0.2, 0.6, 0.9, 1],
        ease: "easeInOut"
      }}
      onAnimationComplete={onComplete}
      className="fixed z-[100] pointer-events-none flex flex-col items-center gap-4"
    >
      <div className="bg-[#131313] border-4 border-[#ffaaf6] p-8 shadow-[0_0_50px_rgba(255,170,246,0.6)] relative">
        <div className="absolute inset-0 bg-[#ffaaf6]/10 animate-pulse" />
        <Icon size={80} className="text-[#ffaaf6] relative z-10" />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#ffaaf6] text-[#131313] px-6 py-2 font-black uppercase tracking-[0.2em] text-2xl shadow-xl"
      >
        {itemName} ACQUIRED
      </motion.div>
    </motion.div>
  );
}
