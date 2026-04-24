import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { SaveSlotSummary } from '../lib/gameEngine';
import { audioService } from '../lib/audioService';
import { DicebearProfile, buildDicebearAvatarUrl } from '../lib/dicebearAvatar';

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
  onDeleteSlot: (slotId: string) => void;
  onSaveSlotNote: (slotId: string, note: string) => void;
  dicebearProfile: DicebearProfile;
}

export default function LoadGameModal({
  isOpen,
  slots,
  onClose,
  onLoad,
  onDeleteSlot,
  onSaveSlotNote,
  dicebearProfile,
}: LoadGameModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const beginEdit = (s: SaveSlotSummary) => {
    setEditingId(s.id);
    setDraftNote(s.note ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftNote('');
  };

  const saveNote = (id: string) => {
    onSaveSlotNote(id, draftNote);
    cancelEdit();
  };

  const hasUnsavedEdits = () => {
    if (!editingId) return false;
    const s = slots.find((x) => x.id === editingId);
    const original = (s?.note ?? '').trim();
    return draftNote.trim() !== original;
  };

  const tryClose = () => {
    if (hasUnsavedEdits()) {
      if (!window.confirm('You have unsaved note changes. Close and discard them?')) return;
    }
    onClose();
  };

  const tryDelete = (id: string) => {
    if (window.confirm('Delete this checkpoint? This cannot be undone.')) {
      onDeleteSlot(id);
      if (editingId === id) cancelEdit();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        tryClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, editingId, draftNote, slots]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-210 flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={tryClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 my-2 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden border-4 border-accent-cyan bg-bg-panel p-6 sm:my-0 sm:p-8"
          >
            <div className="absolute -left-1 -top-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -right-1 -top-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-accent-cyan" />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-accent-cyan" />

            <div className="mb-4 flex shrink-0 items-start justify-between gap-4 sm:mb-6">
              <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-widest text-accent-magenta">
                <Save size={18} /> LOAD GAME
              </h2>
              <button type="button" onMouseEnter={hoverUi} onClick={tryClose} className="text-accent-cyan hover:text-white" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain pr-1">
              {slots.length === 0 ? (
                <div className="border-l-4 border-border-base bg-bg-base p-4 text-sm text-text-primary/70">
                  No save slots found yet.
                </div>
              ) : (
                slots.map((s) => {
                  const isEditing = editingId === s.id;
                  const avatarSrc =
                    s.avatarSrc && s.avatarSrc.trim() !== ''
                      ? s.avatarSrc
                      : buildDicebearAvatarUrl(`${s.playerName || 'PLAYER'}-${s.id}`, dicebearProfile);
                  return (
                    <div
                      key={s.id}
                      className="border-l-4 border-accent-cyan bg-bg-base p-4 text-left transition-colors hover:bg-[#1f1f1f]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div className="flex w-12 shrink-0 flex-col items-center">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden border border-border-base bg-[#0f0f0f]">
                              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="mt-2 text-center text-[10px] uppercase leading-tight tracking-widest text-accent-cyan/80">
                              SCORE:
                              <br />
                              {typeof s.score === 'number' ? s.score : 0}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="text-sm font-black uppercase tracking-wider text-white">{s.playerName || 'PLAYER'}</span>
                              <span className="text-[10px] uppercase tracking-widest text-accent-cyan/80">{formatDate(s.savedAt)}</span>
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-text-primary/70">
                              {s.areaLabel ? s.areaLabel : `00X${s.sceneId.toUpperCase()}`}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              {s.note ? (
                                <div className="text-xs normal-case tracking-normal text-accent-magenta">{s.note}</div>
                              ) : (
                                <div className="text-[10px] uppercase tracking-widest text-text-primary/40">No checkpoint note</div>
                              )}
                              <button
                                type="button"
                                onMouseEnter={hoverUi}
                                onClick={() => (isEditing ? cancelEdit() : beginEdit(s))}
                                className="text-accent-magenta/80 hover:text-accent-magenta"
                                aria-label={isEditing ? 'Cancel note edit' : 'Edit checkpoint note'}
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onMouseEnter={hoverUi}
                            onClick={() => onLoad(s.id)}
                            className="border-2 border-accent-cyan px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-text-inverse"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onMouseEnter={hoverUi}
                            onClick={() => tryDelete(s.id)}
                            className="border-2 border-red-500/60 p-2 text-red-400 hover:bg-red-500/15"
                            aria-label="Delete checkpoint"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-border-base pt-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-accent-cyan/80">Checkpoint note</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-privacy-ignore="true"
                            data-form-type="other"
                            data-gramm="false"
                            data-gramm_editor="false"
                            data-enable-grammarly="false"
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. After getting the key"
                            className="border-2 border-accent-cyan/40 bg-bg-base px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-primary/30 focus:border-accent-cyan focus:outline-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onMouseEnter={hoverUi}
                              onClick={() => saveNote(s.id)}
                              className="bg-accent-cyan px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-inverse hover:bg-white"
                            >
                              Save note
                            </button>
                            <button
                              type="button"
                              onMouseEnter={hoverUi}
                              onClick={cancelEdit}
                              className="border-2 border-border-base px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-primary/80 hover:border-accent-cyan/50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onMouseEnter={hoverUi}
              onClick={tryClose}
              className="mt-4 w-full shrink-0 border-2 border-accent-cyan py-3 text-xs font-black uppercase tracking-widest text-accent-cyan hover:bg-accent-cyan hover:text-text-inverse sm:mt-6"
            >
              CANCEL
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
