import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Delete } from 'lucide-react';
import { audioService } from '../lib/audioService';

const NAMING_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?'.split('');

interface NamingScreenProps {
  onComplete: (name: string) => void;
  onCancel: () => void;
}

export default function NamingScreen({ onComplete, onCancel }: NamingScreenProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const hoverUi = () => audioService.playHoverThrottled();

  const tryStart = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name before starting your adventure.');
      return;
    }
    setNameError(null);
    onComplete(trimmed);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Backspace') {
        setName((prev) => prev.slice(0, -1));
        setNameError(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setNameError('Enter a name before starting your adventure.');
        } else {
          setNameError(null);
          onComplete(trimmed);
        }
      } else if (e.key.length === 1 && NAMING_CHARSET.includes(e.key)) {
        if (name.length < 12) {
          setName((prev) => prev + e.key);
          setNameError(null);
        }
      } else if (e.key === ' ') {
        if (name.length < 12) {
          setName((prev) => prev + ' ');
          setNameError(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [name, onComplete, onCancel]);

  const handleCharClick = (char: string) => {
    if (name.length < 12) {
      setName((prev) => prev + char);
      setNameError(null);
    }
  };

  const handleBackspace = () => {
    setName((prev) => prev.slice(0, -1));
    setNameError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center justify-start overflow-y-auto overscroll-y-contain bg-[#131313] p-3 py-6 sm:justify-center sm:p-4 sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex w-full max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden border-4 border-[#35ebeb] bg-[#1b1b1b] p-6 sm:p-8"
      >
        <div className="absolute -left-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -right-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#35ebeb]" />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
          <div className="mb-4 min-h-[3rem] rounded border-2 border-transparent px-2 py-2 text-center sm:mb-6">
            {nameError ? (
              <p className="text-sm font-bold uppercase leading-snug tracking-wide text-red-400">{nameError}</p>
            ) : null}
          </div>

          <h2 className="mb-5 text-center text-2xl font-black uppercase tracking-widest text-[#ffaaf6] sm:mb-8">REGISTER YOUR NAME</h2>

          <div className="mb-7 flex justify-center sm:mb-12">
            <div className="min-w-[200px] border-b-4 border-[#35ebeb] px-4 py-2 text-center">
              <span className="text-4xl font-mono uppercase tracking-widest text-[#ffffff]">
                {name}
                <span className="ml-1 inline-block h-8 w-4 cursor-blink bg-[#35ebeb]" />
              </span>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-8 gap-2 md:grid-cols-10 sm:mb-8">
            {NAMING_CHARSET.map((char) => (
              <button
                key={char}
                type="button"
                onMouseEnter={hoverUi}
                onClick={() => handleCharClick(char)}
                className="p-2 font-mono text-xl text-[#35ebeb] transition-colors hover:bg-[#35ebeb] hover:text-[#131313]"
              >
                {char}
              </button>
            ))}
            <button
              type="button"
              onMouseEnter={hoverUi}
              onClick={() => handleCharClick(' ')}
              className="p-2 font-mono text-xl text-[#35ebeb] transition-colors hover:bg-[#35ebeb] hover:text-[#131313]"
              aria-label="Space"
            >
              ␣
            </button>
            <button
              type="button"
              onMouseEnter={hoverUi}
              onClick={handleBackspace}
              className="flex items-center justify-center p-2 text-[#35ebeb] transition-colors hover:bg-[#35ebeb] hover:text-[#131313]"
              aria-label="Backspace"
            >
              <Delete size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-stretch justify-between gap-4 border-t border-[#353535] pt-4">
          <button
            type="button"
            onMouseEnter={hoverUi}
            onClick={onCancel}
            className="inline-flex shrink-0 items-center justify-center gap-1 border-2 border-[#ffaaf6] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#ffaaf6] transition-all hover:bg-[#ffaaf6] hover:text-[#131313]"
          >
            <ChevronLeft size={16} strokeWidth={3} className="-mr-0.5 shrink-0" aria-hidden />
            Back
          </button>
          <button
            type="button"
            onMouseEnter={hoverUi}
            onClick={tryStart}
            className="min-w-0 flex-1 bg-[#35ebeb] py-4 text-xs font-black uppercase tracking-widest text-[#131313] transition-all hover:bg-[#ffffff]"
          >
            Start adventure
          </button>
        </div>
      </motion.div>
    </div>
  );
}
