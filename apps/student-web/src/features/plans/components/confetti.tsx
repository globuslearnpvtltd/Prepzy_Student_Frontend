'use client';

import { useEffect, useState } from 'react';

const COLOURS = [
  'var(--color-accent-400)',
  'var(--color-success-500)',
  'var(--color-brand-400)',
  'var(--color-plan-rose)',
  'var(--color-info-400)',
  'var(--color-plan-ok-text)',
  'var(--color-brand-700)',
];

interface Piece {
  left: number;
  size: number;
  colour: string;
  round: boolean;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
}

/** One-off falling confetti (purchase success, welcome screen). Hidden for reduced motion. */
export function Confetti({ pieces = 100, durationMs = 4200 }: { pieces?: number; durationMs?: number }) {
  const [list, setList] = useState<Piece[]>([]);

  useEffect(() => {
    // Random positions are created after mount so server and client markup match.
    setList(
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        size: 6 + Math.random() * 8,
        colour: COLOURS[i % COLOURS.length]!,
        round: Math.random() > 0.6,
        delay: Math.random() * 0.8,
        duration: 1.9 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 220,
        spin: 540 + Math.random() * 540,
      })),
    );
    const timer = window.setTimeout(() => setList([]), durationMs);
    return () => window.clearTimeout(timer);
  }, [pieces, durationMs]);

  if (list.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <style>{`
        @keyframes plan-confetti { 0% { transform: translate3d(0,-12vh,0) rotate(0deg); opacity: 0 } 8% { opacity: 1 }
          85% { opacity: 1 } 100% { transform: translate3d(var(--drift),105vh,0) rotate(var(--spin)); opacity: 0 } }
        .plan-confetti { position: absolute; top: 0; animation: plan-confetti cubic-bezier(.25,.5,.5,1) forwards }
        @media (prefers-reduced-motion: reduce) { .plan-confetti { display: none } }
      `}</style>
      {list.map((piece, index) => (
        <span
          key={index}
          className="plan-confetti"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * (piece.round ? 1 : 1.6),
            backgroundColor: piece.colour,
            borderRadius: piece.round ? 9999 : 2,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
