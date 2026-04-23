import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { resolveIconComponent } from '../lib/iconRegistry';

const NARROW_MOBILE = '(max-width: 767px)';

interface InventoryAnimationProps {
  itemId?: string;
  itemName: string;
  iconName?: string;
  target?: 'inventory' | 'equipment';
  startDelayMs?: number;
  onComplete: () => void;
}

export default function InventoryAnimation({
  itemId,
  itemName,
  iconName,
  target = 'inventory',
  startDelayMs = 0,
  onComplete,
}: InventoryAnimationProps) {
  const [narrow, setNarrow] = useState(false);
  const [phase, setPhase] = useState<'pre' | 'reveal' | 'fly'>('pre');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MOBILE);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      requestAnimationFrame(() => setPhase('reveal'));
    }, Math.max(0, startDelayMs));
    const flyTimer = window.setTimeout(() => setPhase('fly'), Math.max(0, startDelayMs) + 430);
    const doneTimer = window.setTimeout(() => onCompleteRef.current(), Math.max(0, startDelayMs) + 1560);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(flyTimer);
      window.clearTimeout(doneTimer);
    };
  }, [startDelayMs]);

  const Icon = resolveIconComponent(iconName) as React.ComponentType<{
    size?: number;
    className?: string;
  }>;
  const iconSize = narrow ? 44 : 76;

  const motionStyles = useMemo(() => {
    const revealTransform = 'translate(-50%, -54%) scale(1)';
    const xDelta = target === 'equipment' ? (narrow ? '-42vw' : '-38vw') : narrow ? '42vw' : '38vw';
    const yDelta = narrow ? '-38vh' : '-42vh';
    const flyTransform = `translate(calc(-50% + ${xDelta}), calc(-50% + ${yDelta})) scale(0)`;
    if (phase === 'pre') {
      return {
        transform: 'translate(-50%, -48%) scale(0.9)',
        opacity: 0,
        transition: 'opacity 220ms ease-in-out, transform 220ms ease-in-out',
      };
    }
    if (phase === 'reveal') {
      return {
        transform: revealTransform,
        opacity: 1,
        transition: 'opacity 260ms ease-in-out, transform 260ms ease-in-out',
      };
    }
    return {
      transform: flyTransform,
      opacity: 0,
      transition: 'opacity 1080ms ease-in-out, transform 1080ms ease-in-out',
    };
  }, [narrow, phase, target]);

  const overlayOpacity = phase === 'fly' ? 0 : 0.55;

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none">
      <div
        className="absolute inset-0 bg-black transition-opacity duration-300 ease-in-out"
        style={{ opacity: overlayOpacity }}
      />

      <div
        data-item-id={itemId}
        className={clsx('absolute left-1/2 top-1/2 flex flex-col items-center', narrow ? 'gap-2' : 'gap-3')}
        style={motionStyles}
      >
        <div
          className={clsx(
            'relative border-4 border-[#35ebeb] bg-[#131313]',
            narrow ? 'p-4 shadow-[0_0_32px_rgba(53,235,235,0.45)]' : 'p-7 shadow-[0_0_60px_rgba(53,235,235,0.55)]',
          )}
        >
          <div className="absolute inset-0 bg-[#35ebeb]/10" />
          <Icon size={iconSize} className="relative z-10 text-[#35ebeb]" />
        </div>

        <div
          className={clsx(
            'bg-[#35ebeb] text-center font-black uppercase text-[#131313] shadow-xl',
            narrow
              ? 'max-w-[min(92vw,20rem)] px-3 py-1.5 text-xs leading-snug tracking-[0.12em]'
              : 'max-w-[min(92vw,24rem)] px-5 py-2 text-xl tracking-[0.2em]',
          )}
        >
          {itemName} ACQUIRED
        </div>
      </div>
    </div>
  );
}
