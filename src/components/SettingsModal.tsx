import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, VolumeX, Volume1, Save, LogOut, HelpCircle, Power, ScrollText } from 'lucide-react';
import { audioService } from '../lib/audioService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
  ambientVolume: number;
  onAmbientVolumeChange: (val: number) => void;
  sfxVolume: number;
  onSfxVolumeChange: (val: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isAmbientMuted: boolean;
  onToggleAmbientMute: () => void;
  isSfxMuted: boolean;
  onToggleSfxMute: () => void;
  /** On narrow viewports the footer hides these — same actions appear here. */
  onSystemReboot?: () => void;
  onHelp?: () => void;
  onDataLog?: () => void;
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onReset, 
  ambientVolume, 
  onAmbientVolumeChange, 
  sfxVolume,
  onSfxVolumeChange,
  isMuted, 
  onToggleMute,
  isAmbientMuted,
  onToggleAmbientMute,
  isSfxMuted,
  onToggleSfxMute,
  onSystemReboot,
  onHelp,
  onDataLog,
}: SettingsModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative z-10 my-2 w-full max-h-[calc(100dvh-2rem)] max-w-md overflow-x-hidden overflow-y-auto border-4 border-[#35ebeb] bg-[#1b1b1b] p-6 sm:my-0 sm:p-8"
          >
            <div className="absolute -top-1 -left-1 w-4 h-4 bg-[#35ebeb]" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#35ebeb]" />

            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-[#ffaaf6] tracking-widest uppercase">SYSTEM SETTINGS</h2>
              <button type="button" onMouseEnter={hoverUi} onClick={onClose} className="text-[#35ebeb] hover:text-[#ffffff] transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Audio Controls */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex items-center gap-2 text-[#35ebeb] font-bold uppercase tracking-widest text-sm">
                    {isMuted ? <VolumeX size={18} /> : ambientVolume > 0.5 ? <Volume2 size={18} /> : <Volume1 size={18} />}
                    AUDIO
                    </div>
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={onToggleMute}
                      className={`px-3 py-1.5 border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                        isMuted
                          ? 'bg-[#ffaaf6] border-[#ffaaf6] text-[#131313]'
                          : 'border-[#35ebeb] text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#131313]'
                      }`}
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                  <span className="shrink-0 text-[#35ebeb] font-mono">{Math.round(ambientVolume * 100)}%</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]/80">BGM</div>
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={onToggleAmbientMute}
                      className={`px-2 py-1 border text-[10px] font-black uppercase tracking-widest transition-all ${
                        isAmbientMuted
                          ? 'bg-[#ffaaf6] border-[#ffaaf6] text-[#131313]'
                          : 'border-[#35ebeb]/60 text-[#35ebeb]/90 hover:bg-[#35ebeb] hover:text-[#131313]'
                      }`}
                    >
                      {isAmbientMuted ? 'UNMUTE' : 'MUTE'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={ambientVolume}
                      onChange={(e) => onAmbientVolumeChange(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-[#131313] appearance-none cursor-pointer accent-[#35ebeb] border border-[#35ebeb]/30"
                      disabled={isAmbientMuted}
                    />
                    <div className="w-12 text-right text-[10px] text-[#35ebeb]/80">{Math.round(ambientVolume * 100)}%</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]/80">SFX</div>
                    <button
                      type="button"
                      onMouseEnter={hoverUi}
                      onClick={onToggleSfxMute}
                      className={`px-2 py-1 border text-[10px] font-black uppercase tracking-widest transition-all ${
                        isSfxMuted
                          ? 'bg-[#ffaaf6] border-[#ffaaf6] text-[#131313]'
                          : 'border-[#35ebeb]/60 text-[#35ebeb]/90 hover:bg-[#35ebeb] hover:text-[#131313]'
                      }`}
                    >
                      {isSfxMuted ? 'UNMUTE' : 'MUTE'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={sfxVolume}
                      onChange={(e) => onSfxVolumeChange(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-[#131313] appearance-none cursor-pointer accent-[#35ebeb] border border-[#35ebeb]/30"
                      disabled={isSfxMuted}
                    />
                    <div className="w-12 text-right text-[10px] text-[#35ebeb]/80">{Math.round(sfxVolume * 100)}%</div>
                  </div>
                </div>
              </div>

              {(onSystemReboot || onHelp || onDataLog) && (
                <div className="space-y-3 border-t border-[#353535] pt-6 md:hidden">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#35ebeb]/60">Footer shortcuts</p>
                  <div className="flex flex-col gap-2">
                    {onSystemReboot && (
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          onClose();
                          onSystemReboot();
                        }}
                        className="flex w-full items-center justify-between border-2 border-[#35ebeb]/60 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb]/15"
                      >
                        <span>System reboot</span>
                        <Power size={16} />
                      </button>
                    )}
                    {onHelp && (
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          onClose();
                          onHelp();
                        }}
                        className="flex w-full items-center justify-between border-2 border-[#35ebeb]/60 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb]/15"
                      >
                        <span>Help</span>
                        <HelpCircle size={16} />
                      </button>
                    )}
                    {onDataLog && (
                      <button
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          onClose();
                          onDataLog();
                        }}
                        className="flex w-full items-center justify-between border-2 border-[#ffaaf6]/50 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#ffaaf6] hover:bg-[#ffaaf6]/10"
                      >
                        <span>Data log</span>
                        <ScrollText size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Game Actions */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-[#353535]">
                <button 
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={() => { onSave(); onClose(); }}
                  className="w-full bg-[#ffffff] text-[#002020] font-black py-4 px-6 uppercase tracking-widest hover:bg-[#35ebeb] transition-all flex justify-between items-center group"
                >
                  <span>SAVE PROGRESS</span>
                  <Save size={20} />
                </button>
                
                <button 
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={() => { onReset(); onClose(); }}
                  className="w-full border-2 border-red-500 text-red-500 font-black py-4 px-6 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex justify-between items-center group"
                >
                  <span>TERMINATE SESSION</span>
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#353535] text-center">
              <div className="text-[10px] text-[#35ebeb]/50 uppercase tracking-[0.3em]">SENTIENT TERMINAL v1.9.88</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
