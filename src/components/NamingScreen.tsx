import React, { useState } from 'react';
import { motion } from 'motion/react';

interface NamingScreenProps {
  onComplete: (name: string) => void;
}

export default function NamingScreen({ onComplete }: NamingScreenProps) {
  const [name, setName] = useState('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!? '.split('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (name.length > 0) onComplete(name);
        else onComplete('Josh');
      } else if (e.key.length === 1 && alphabet.includes(e.key.toUpperCase()) || alphabet.includes(e.key)) {
        if (name.length < 12) {
          setName(prev => prev + e.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [name, onComplete]);

  const handleCharClick = (char: string) => {
    if (name.length < 12) {
      setName(prev => prev + char);
    }
  };

  const handleBackspace = () => {
    setName(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-[#131313] flex flex-col items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl border-4 border-[#35ebeb] p-8 bg-[#1b1b1b] relative"
      >
        <div className="absolute -top-1 -left-1 w-4 h-4 bg-[#35ebeb]" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-[#35ebeb]" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#35ebeb]" />

        <h2 className="text-2xl font-black text-[#ffaaf6] mb-8 text-center tracking-widest uppercase">
          REGISTER YOUR NAME
        </h2>

        <div className="mb-12 flex justify-center">
          <div className="border-b-4 border-[#35ebeb] px-4 py-2 min-w-[200px] text-center">
            <span className="text-4xl font-mono text-[#ffffff] tracking-widest uppercase">
              {name}
              <span className="inline-block w-4 h-8 bg-[#35ebeb] ml-1 cursor-blink" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-8 md:grid-cols-10 gap-2 mb-8">
          {alphabet.map(char => (
            <button
              key={char}
              onClick={() => handleCharClick(char)}
              className="p-2 text-xl font-mono text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#131313] transition-colors"
            >
              {char === ' ' ? '␣' : char}
            </button>
          ))}
        </div>

        <div className="flex justify-between gap-4">
          <button
            onClick={handleBackspace}
            className="flex-1 border-2 border-[#ffaaf6] text-[#ffaaf6] py-3 font-bold hover:bg-[#ffaaf6] hover:text-[#131313] transition-all uppercase tracking-widest"
          >
            BACKSPACE
          </button>
          <button
            onClick={() => onComplete(name || 'Josh')}
            className="flex-1 bg-[#35ebeb] text-[#131313] py-3 font-bold hover:bg-[#ffffff] transition-all uppercase tracking-widest"
          >
            START ADVENTURE
          </button>
        </div>
      </motion.div>
    </div>
  );
}
