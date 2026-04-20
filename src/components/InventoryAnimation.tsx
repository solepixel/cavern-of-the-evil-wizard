import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';

const NARROW_MOBILE = '(max-width: 767px)';

interface InventoryAnimationProps {
  itemName: string;
  iconName?: string;
  onComplete: () => void;
}

export default function InventoryAnimation({ itemName, iconName, onComplete }: InventoryAnimationProps) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MOBILE);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const Resolved =
    iconName && iconName in LucideIcons
      ? (LucideIcons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName]
      : undefined;
  const Icon = typeof Resolved === 'function' ? Resolved : LucideIcons.Package;
  const iconSize = narrow ? 44 : 76;
  const flyScale = narrow ? ([0.55, 0.92, 0.85, 0.72] as const) : ([0.6, 1.15, 1.05, 0.9] as const);
  const flyX = narrow ? (['-50%', '-50%', '10vw', '12vw'] as const) : (['-50%', '-50%', '36vw', '40vw'] as const);
  const flyY = narrow ? (['42vh', '8vh', '6vh', '6vh'] as const) : (['45vh', '0vh', '0vh', '0vh'] as const);

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
        initial={{ scale: narrow ? 0.55 : 0.6, opacity: 0, x: '-50%', y: narrow ? '42vh' : '45vh', left: '50%', top: '50%' }}
        animate={{
          scale: [...flyScale],
          opacity: [0, 1, 1, 0],
          x: [...flyX],
          y: [...flyY],
        }}
        transition={{
          duration: 1.7,
          times: [0, 0.25, 0.75, 1],
          ease: [0.22, 0.99, 0.36, 1],
        }}
        onAnimationComplete={onComplete}
        className={clsx('absolute flex flex-col items-center', narrow ? 'gap-2' : 'gap-3')}
      >
        <div
          className={clsx(
            'relative border-4 border-[#ffaaf6] bg-[#131313]',
            narrow ? 'p-4 shadow-[0_0_32px_rgba(255,170,246,0.45)]' : 'p-7 shadow-[0_0_60px_rgba(255,170,246,0.55)]',
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-[#ffaaf6]/10"
          />
          <Icon size={iconSize} className="relative z-10 text-[#ffaaf6]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, 0] }}
          transition={{ duration: 1.7, times: [0, 0.25, 0.75, 1], ease: 'easeOut' }}
          className={clsx(
            'bg-[#ffaaf6] text-center font-black uppercase text-[#131313] shadow-xl',
            narrow
              ? 'max-w-[min(92vw,20rem)] px-3 py-1.5 text-xs leading-snug tracking-[0.12em]'
              : 'max-w-[min(92vw,24rem)] px-5 py-2 text-xl tracking-[0.2em]',
          )}
        >
          {itemName} ACQUIRED
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
