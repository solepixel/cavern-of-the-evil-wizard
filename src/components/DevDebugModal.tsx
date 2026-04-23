import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { GameState } from '../types';
import { audioService } from '../lib/audioService';
import { buildGameplayDebugSnapshot } from '../lib/debugSnapshot';
import { SCENES } from '../gameData';

interface DevDebugModalProps {
  state: GameState;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border-base py-3 last:border-b-0">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent-magenta">{title}</h3>
      <div className="space-y-1 text-[11px] leading-snug text-[#c8c8c8]">{children}</div>
    </section>
  );
}

function Lines({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-0.5 font-mono">
      {items.map((line, i) => (
        <li key={i} className="break-all">
          {line}
        </li>
      ))}
    </ul>
  );
}

export default function DevDebugModal({ state, onClose }: DevDebugModalProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hoverUi = () => audioService.playHoverThrottled();
  const snap = buildGameplayDebugSnapshot(state);
  const audio = audioService.getDebugAudioSnapshot();

  return (
    <div className="fixed inset-0 z-200 flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 my-2 flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden border-4 border-accent-cyan bg-bg-base sm:my-0"
      >
        <div className="absolute -left-1 -top-1 h-3 w-3 bg-accent-cyan" />
        <div className="absolute -right-1 -top-1 h-3 w-3 bg-accent-cyan" />
        <div className="absolute -bottom-1 -left-1 h-3 w-3 bg-accent-cyan" />
        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-accent-cyan" />

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-base p-4 pr-3">
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-accent-magenta">DATA_LOG</h2>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-accent-cyan/80">Dev snapshot — updates live</p>
          </div>
          <button type="button" onMouseEnter={hoverUi} onClick={onClose} className="text-accent-cyan hover:text-white" aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4">
          <Section title="Audio">
            <Lines
              items={[
                `BGM: ${audio.ambientSrc}`,
                `BGM playing: ${!audio.ambientPaused} | time: ${audio.ambientCurrentTimeSec != null ? audio.ambientCurrentTimeSec.toFixed(1) + 's' : '—'} | vol: ${(audio.ambientVolume * 100).toFixed(0)}%`,
                `mute: ${audio.preferences.muted} | ambientMuted: ${audio.preferences.ambientMuted} | sfxMuted: ${audio.preferences.sfxMuted}`,
                `SFX vol: ${(audio.preferences.sfxVolume * 100).toFixed(0)}%`,
                `Last SFX: ${audio.lastSfx ?? '(none yet)'}`,
              ]}
            />
          </Section>

          <Section title="Scene">
            <Lines
              items={[
                `id: ${snap.sceneId}`,
                `title: ${snap.sceneTitle}`,
                `exists in SCENES: ${snap.sceneExists}`,
                `exits: ${snap.sceneExits}`,
                `viewport: image/bg=${sceneViewportSrc(state)}`,
              ]}
            />
            {snap.sceneCommandPatterns.length > 0 && (
              <p className="mt-2 text-[10px] font-bold uppercase text-text-primary/50">Scene command regex keys</p>
            )}
            {snap.sceneCommandPatterns.length > 0 && <Lines items={snap.sceneCommandPatterns} />}
            {snap.interactionLabels.length > 0 && (
              <>
                <p className="mt-2 text-[10px] font-bold uppercase text-text-primary/50">Interaction labels</p>
                <Lines items={snap.interactionLabels} />
              </>
            )}
          </Section>

          <Section title="Character">
            <Lines items={snap.character} />
          </Section>

          <Section title="Inventory">
            <Lines items={snap.inventoryLines} />
          </Section>

          <Section title="Flags">
            <Lines items={snap.flagsLines} />
          </Section>

          <Section title="Object states (global)">
            <Lines items={snap.objectStatesLines} />
          </Section>

          <Section title="Scene objects & interactions">
            {snap.objects.length === 0 ? (
              <p className="text-text-primary/50">No objects in this scene.</p>
            ) : (
              snap.objects.map((o) => (
                <div key={o.objectId} className="mb-4 border-l-2 border-accent-cyan/40 pl-2 last:mb-0">
                  <p className="mb-1 font-mono text-[11px] font-bold text-accent-cyan">
                    {o.objectId} — {o.name} <span className="font-normal text-text-primary/70">state: {o.state}</span>
                  </p>
                  <Lines items={o.lines.length ? o.lines : ['(no interactions)']} />
                </div>
              ))
            )}
          </Section>

          <Section title="Meta">
            <Lines items={snap.meta} />
          </Section>

          <Section title="History (last 12 lines)">
            <Lines
              items={
                state.history.length === 0
                  ? ['(empty)']
                  : (() => {
                      const tail = state.history.slice(-12);
                      const start = state.history.length - tail.length;
                      return tail.map((line, i) => `${start + i + 1}. ${line}`);
                    })()
              }
            />
          </Section>
        </div>

        <div className="shrink-0 border-t border-border-base p-3">
          <button
            type="button"
            onMouseEnter={hoverUi}
            onClick={onClose}
            className="w-full border-2 border-accent-cyan py-2 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-text-inverse"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function sceneViewportSrc(state: GameState): string {
  const s = SCENES[state.currentSceneId];
  if (!s) return '—';
  return s.image ?? s.background ?? '(none)';
}
