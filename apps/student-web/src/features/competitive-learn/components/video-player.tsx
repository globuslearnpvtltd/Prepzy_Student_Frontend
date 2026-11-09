'use client';

import { cx } from '@prepzy/design-system';
import { Clock, Languages, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { youTubeId } from '../api';

const capitalize = (value: string) => (value ? value[0]!.toUpperCase() + value.slice(1) : value);

/**
 * True when a message from a YouTube embed (enablejsapi=1) says playback ended. YouTube posts either
 * `onStateChange` with `info: 0` or `infoDelivery` with `info.playerState: 0`.
 */
export function isYouTubeEnded(data: unknown): boolean {
  let message: unknown = data;
  if (typeof message === 'string') {
    try {
      message = JSON.parse(message);
    } catch {
      return false;
    }
  }
  if (!message || typeof message !== 'object') return false;
  const { event, info } = message as { event?: unknown; info?: unknown };
  if (event === 'onStateChange') return info === 0;
  if (event === 'infoDelivery' && info && typeof info === 'object') return (info as { playerState?: unknown }).playerState === 0;
  return false;
}

/** Chalkboard of physics / chemistry / biology notation behind the poster (decorative). */
function FormulaBackdrop() {
  const formula = 'fill-on-brand font-serif';
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="800" height="450" className="fill-night-950" />
      <text x="40" y="70" fillOpacity="0.14" fontSize="26" className={formula} transform="rotate(-4 40 70)">E = mc²</text>
      <text x="640" y="60" fillOpacity="0.12" fontSize="20" className={formula} transform="rotate(3 640 60)">v = u + at</text>
      <text x="590" y="140" fillOpacity="0.1" fontSize="18" className={formula}>F = q(v × B)</text>
      <text x="30" y="230" fillOpacity="0.1" fontSize="18" className={formula}>λ = h / mv</text>
      <text x="330" y="34" fillOpacity="0.1" fontSize="16" className={formula}>T = 2π√(m/k)</text>
      <text x="470" y="250" fillOpacity="0.12" fontSize="20" className={formula}>PV = nRT</text>
      <text x="90" y="330" fillOpacity="0.1" fontSize="18" className={formula}>ΔG = ΔH − TΔS</text>
      <g transform="translate(700,300)" className="stroke-on-brand" strokeOpacity="0.14" fill="none" strokeWidth="1.5">
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" />
        <line x1="0" y1="-22" x2="0" y2="-32" />
        <line x1="19" y1="11" x2="30" y2="17" />
        <line x1="-19" y1="11" x2="-30" y2="17" />
      </g>
      <g className="stroke-on-brand" strokeOpacity="0.12" fill="none" strokeWidth="1.5">
        <path d="M120 380 C150 355, 150 405, 180 380 C210 355, 210 405, 240 380" />
        <path d="M120 380 C150 405, 150 355, 180 380 C210 405, 210 355, 240 380" />
        <line x1="135" y1="380" x2="165" y2="380" />
        <line x1="195" y1="380" x2="225" y2="380" />
      </g>
      <g className="stroke-on-brand" strokeOpacity="0.12" fill="none" strokeWidth="1.2">
        <line x1="380" y1="330" x2="620" y2="330" strokeDasharray="4 4" />
        <ellipse cx="470" cy="330" rx="10" ry="42" />
        <line x1="380" y1="300" x2="470" y2="330" />
        <line x1="470" y1="330" x2="600" y2="300" />
        <line x1="470" y1="330" x2="600" y2="360" />
      </g>
      <text x="230" y="130" fillOpacity="0.08" fontSize="42" className={formula}>∫</text>
      <text x="500" y="410" fillOpacity="0.09" fontSize="18" className={formula}>ω = √(k/m)</text>
    </svg>
  );
}

function LanguageMenu({ languages, language, onChange }: { languages: string[]; language: string; onChange: (language: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose language"
        aria-expanded={open}
        className="text-on-brand/70 hover:text-on-brand flex items-center gap-1 transition"
      >
        <Languages aria-hidden className="size-[18px]" />
        <span className="text-xs font-medium">{capitalize(language)}</span>
      </button>
      {open && (
        <ul role="menu" className="bg-neutral-950/90 ring-on-brand/10 absolute right-0 bottom-full mb-2 min-w-[130px] overflow-hidden rounded-md py-1.5 ring-1">
          {languages.map((option) => (
            <li key={option} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === language}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cx(
                  'hover:bg-surface/10 block w-full px-4 py-1.5 text-left text-xs font-medium',
                  option === language ? 'text-brand-300' : 'text-on-brand/85',
                )}
              >
                {capitalize(option)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Lecture player: a poster with the chalkboard backdrop until the student presses play, then a YouTube embed
 * or the browser's own video player. `onEnded` fires once when playback reaches the end.
 */
export function VideoPlayer({
  url,
  title,
  languages,
  language,
  onLanguageChange,
  onEnded,
}: {
  url: string;
  title: string;
  languages: string[];
  language: string;
  onLanguageChange: (language: string) => void;
  onEnded?: () => void;
}) {
  const [started, setStarted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const videoId = youTubeId(url);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const ended = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndedRef.current?.();
  }, []);

  useEffect(() => {
    if (!started || !videoId) return;
    const listen = (event: MessageEvent) => {
      if (event.source === frameRef.current?.contentWindow && isYouTubeEnded(event.data)) ended();
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [started, videoId, ended]);

  const showLanguages = languages.length > 1;

  return (
    <div
      data-testid="video-player"
      className="group border-on-brand/10 bg-night-950 relative h-[90%] w-full overflow-hidden rounded-2xl border-4 shadow-lg md:rounded-lg md:border-0"
    >
      {started ? (
        <>
          {videoId ? (
            <iframe
              ref={frameRef}
              title={title || 'Lecture video'}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&playsinline=1&cc_load_policy=1`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              onLoad={() => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <video src={url} title={title} controls autoPlay playsInline onEnded={ended} className="absolute inset-0 h-full w-full" />
          )}
          {showLanguages && (
            <div className="bg-neutral-950/60 absolute top-2 left-2 z-20 rounded-full px-3 py-1.5">
              <LanguageMenu languages={languages} language={language} onChange={onLanguageChange} />
            </div>
          )}
        </>
      ) : (
        <>
          <FormulaBackdrop />
          <div className="from-neutral-950/60 pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b to-transparent" />
          <span className="bg-neutral-950/60 text-on-brand ring-on-brand/10 pointer-events-none absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums ring-1 sm:top-3 sm:right-3 sm:px-3 sm:py-1.5 sm:text-xs">
            <Clock aria-hidden className="size-3" />
            0:00
          </span>
          <button
            type="button"
            onClick={() => setStarted(true)}
            aria-label="Play video"
            className="bg-surface absolute top-1/2 left-1/2 z-30 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:size-20"
          >
            <Play aria-hidden className="fill-brand-450 text-brand-450 ml-1 size-7 sm:size-8" />
          </button>
          <div className="from-neutral-950/85 via-neutral-950/50 text-on-brand absolute inset-x-0 bottom-0 z-20 bg-linear-to-t to-transparent px-3 pt-8 pb-3 sm:px-5 sm:pt-10 sm:pb-4">
            {title && <h3 className="mt-1 truncate text-sm font-semibold sm:text-lg">{title}</h3>}
            <div className="mt-2 flex items-center justify-end gap-3 sm:mt-3 sm:gap-4">
              {showLanguages && <LanguageMenu languages={languages} language={language} onChange={onLanguageChange} />}
            </div>
            <div className="bg-surface/20 mt-3 h-1.5 w-full rounded-full" />
            <div className="text-on-brand/50 mt-1.5 flex items-center justify-between text-[11px] font-medium tracking-wide uppercase">
              <span>0:00 watched</span>
              <span>0:00 remaining</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
