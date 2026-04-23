import React from 'react';
import Typewriter from '../Typewriter';
import { classifyTerminalMessage } from '../../lib/terminalMessages';

interface TerminalViewProps {
  lines: string[];
  skipTypewriter: boolean;
  onTypewriterComplete: (lineIndex: number) => void;
  onContentChange: () => void;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function TerminalView({
  lines,
  skipTypewriter,
  onTypewriterComplete,
  onContentChange,
  terminalEndRef,
}: TerminalViewProps) {
  return (
    <div className="terminal-scroll mb-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 font-mono md:mb-4 md:pr-4">
      {lines.map((line, i) => {
        const message = classifyTerminalMessage(line);
        const isLast = i === lines.length - 1;
        if (message.kind === 'command') {
          return (
            <div key={i} className="font-bold text-accent-cyan">
              {message.text}
            </div>
          );
        }
        if (message.kind === 'system') {
          return (
            <div key={i} className="text-sm text-[#a8a8a8]">
              {message.text}
            </div>
          );
        }
        if (message.kind === 'fatal') {
          return (
            <div key={i} className="font-black uppercase tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">
              <Typewriter
                text={message.text}
                disableInlineHighlights
                skip={skipTypewriter || !isLast}
                onComplete={() => onTypewriterComplete(i)}
                onContentChange={onContentChange}
              />
            </div>
          );
        }
        return (
          <div key={i} className="opacity-90 text-text-primary">
            <Typewriter
              text={message.text}
              skip={skipTypewriter || !isLast}
              onComplete={() => onTypewriterComplete(i)}
              onContentChange={onContentChange}
            />
          </div>
        );
      })}
      <div ref={terminalEndRef} />
    </div>
  );
}
