import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

interface CollapsiblePanelProps {
  title: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  expanded,
  onToggle,
  className,
  contentClassName,
  children,
}: CollapsiblePanelProps) {
  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      <button
        type="button"
        onClick={onToggle}
        className={clsx('flex w-full items-center justify-between gap-3', expanded ? 'mb-3 md:mb-4' : 'mb-0')}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-2 font-black uppercase tracking-widest text-accent-magenta">{title}</span>
        <span className="shrink-0 font-mono text-xs font-black text-accent-cyan">
          <ChevronDown size={16} className={clsx('transition-transform', !expanded && '-rotate-90')} />
        </span>
      </button>
      {expanded && (
        <div className={clsx('min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain', contentClassName)}>{children}</div>
      )}
    </div>
  );
}

interface PanelRowButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'inventory' | 'scene';
  animated?: boolean;
}

export function PanelRowButton({
  icon,
  label,
  onClick,
  disabled,
  variant = 'scene',
}: PanelRowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'group flex w-full items-center gap-3 border-l-4 p-3 text-left transition-all',
        variant === 'inventory'
          ? 'border-accent-cyan bg-bg-base hover:bg-bg-muted'
          : 'border-border-base bg-[#0f0f0f] hover:bg-[#202020]',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-inherit',
      )}
    >
      <div className={variant === 'inventory' ? 'text-accent-cyan' : 'text-text-primary/60'}>{icon}</div>
      <div className={clsx('text-sm font-bold uppercase', variant === 'inventory' ? 'text-white' : 'text-text-primary/90')}>
        {label}
      </div>
    </button>
  );
}
