import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ITEMS } from '../gameData';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  skip?: boolean;
  /** Fires when visible text grows (for scroll-into-view) */
  onContentChange?: () => void;
  /** Skip ALL-CAPS / inventory word coloring so parent styles (e.g. fatal red) apply to the whole line. */
  disableInlineHighlights?: boolean;
}

/** Wrap ALL-CAPS words (2+ letters) in styled spans — interaction hints. Skips fragments already rendered as nodes. */
function highlightAllCapsWords(parts: (string | React.ReactNode)[]): (string | React.ReactNode)[] {
  const out: (string | React.ReactNode)[] = [];
  let key = 0;

  parts.forEach((part) => {
    if (typeof part !== 'string') {
      out.push(part);
      return;
    }
    const segments = part.split(/(\b[A-Z]{2,}\b)/g);
    segments.forEach((seg, si) => {
      if (!seg) return;
      if (/^[A-Z]{2,}$/.test(seg)) {
        out.push(
          <span key={`caps-${key++}-${si}-${seg}`} className="font-bold text-[#35ebeb]">
            {seg}
          </span>,
        );
      } else {
        out.push(seg);
      }
    });
  });

  return out;
}

/** Explicit authoring marker: `[[TEXT]]` => highlighted `TEXT` (brackets removed). */
function highlightBracketMarkers(parts: (string | React.ReactNode)[]): (string | React.ReactNode)[] {
  const out: (string | React.ReactNode)[] = [];
  let key = 0;
  parts.forEach((part) => {
    if (typeof part !== 'string') {
      out.push(part);
      return;
    }
    const segments = part.split(/(\[\[[^[\]]+\]\])/g);
    segments.forEach((seg, si) => {
      if (!seg) return;
      const m = seg.match(/^\[\[([^[\]]+)\]\]$/);
      if (m) {
        out.push(
          <span key={`mark-${key++}-${si}`} className="font-black text-[#ffaaf6]">
            {m[1]}
          </span>,
        );
      } else {
        out.push(seg);
      }
    });
  });
  return out;
}

export default function Typewriter({
  text,
  speed = 20,
  onComplete,
  skip = false,
  onContentChange,
  disableInlineHighlights = false,
}: TypewriterProps) {
  const segments = useMemo(() => text.split(/\n\n+/).filter((s) => s.length > 0), [text]);
  const [segmentIdx, setSegmentIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCompleteRef = useRef(onComplete);
  const onContentChangeRef = useRef(onContentChange);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const displayedText = useMemo(() => {
    if (skip || done) return text;
    const parts: string[] = [];
    for (let i = 0; i < segmentIdx; i++) {
      parts.push(segments[i]);
    }
    if (segments[segmentIdx] !== undefined) {
      parts.push(segments[segmentIdx].slice(0, charIdx));
    }
    return parts.join('\n\n');
  }, [text, segments, segmentIdx, charIdx, skip, done]);

  useEffect(() => {
    onContentChangeRef.current?.();
  }, [displayedText]);

  useEffect(() => {
    setSegmentIdx(0);
    setCharIdx(0);
    setDone(false);
  }, [text]);

  useEffect(() => {
    if (skip) {
      setDone(true);
      onCompleteRef.current?.();
      return;
    }

    if (done) return;

    if (segments.length === 0) {
      setDone(true);
      onCompleteRef.current?.();
      return;
    }

    const current = segments[segmentIdx];
    if (current === undefined) {
      setDone(true);
      onCompleteRef.current?.();
      return;
    }

    if (charIdx < current.length) {
      timerRef.current = setTimeout(() => {
        setCharIdx((c) => c + 1);
      }, speed);
    } else if (segmentIdx < segments.length - 1) {
      timerRef.current = setTimeout(() => {
        setSegmentIdx((s) => s + 1);
        setCharIdx(0);
      }, speed);
    } else {
      setDone(true);
      onCompleteRef.current?.();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [segmentIdx, charIdx, segments, speed, skip, text, done]);

  const renderHighlightedText = (content: string) => {
    if (disableInlineHighlights) {
      return content;
    }
    let result: (string | React.ReactNode)[] = highlightBracketMarkers([content]);

    const sortedItems = Object.values(ITEMS).sort((a, b) => b.name.length - a.name.length);

    sortedItems.forEach((item) => {
      const itemName = item.name.toUpperCase();
      const newResult: (string | React.ReactNode)[] = [];

      result.forEach((part) => {
        if (typeof part === 'string') {
          const regex = new RegExp(`(${itemName})`, 'gi');
          const fragments = part.split(regex);
          fragments.forEach((fragment, i) => {
            if (fragment.toUpperCase() === itemName) {
              newResult.push(
                <span key={`${item.id}-${i}`} className="font-black text-[#ffaaf6]">
                  {fragment}
                </span>,
              );
            } else if (fragment) {
              newResult.push(fragment);
            }
          });
        } else {
          newResult.push(part);
        }
      });
      result = newResult;
    });

    return highlightAllCapsWords(result);
  };

  const showCaret = !skip && !done;

  return (
    <div className="relative inline-block max-w-full whitespace-pre-wrap break-words">
      {renderHighlightedText(skip || done ? text : displayedText)}
      {showCaret && (
        <span
          className={`ml-1 inline-block h-4 w-2 animate-pulse align-middle ${disableInlineHighlights ? 'bg-red-400' : 'bg-[#35ebeb]'}`}
        />
      )}
    </div>
  );
}
