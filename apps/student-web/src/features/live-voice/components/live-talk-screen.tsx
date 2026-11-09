'use client';

import { cx } from '@prepzy/design-system';
import { useEffect, useRef, useState } from 'react';
import { useLiveVoice } from '../provider';
import { formatClock, splitAvatarName, splitReply, waveAmp } from '../text';
import { isDashboardVariant, type VoiceLanguage, type VoicePhase } from '../types';
import {
  CheckIcon,
  ChevronIcon,
  DotsIcon,
  HangUpIcon,
  InfoIcon,
  KeyboardIcon,
  LanguageIcon,
  MicIcon,
  MicOffIcon,
  MicOffStandIcon,
  MicStandIcon,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  WarningIcon,
} from './icons';
import { SpokenText } from './spoken-text';
import { useVoiceLevels } from './use-voice-levels';
import { VoiceReplyText } from './voice-reply-text';

/** Colours for the animated parts (inline styles), from the design tokens. */
const C = {
  purple: 'var(--color-brand)',
  amber: 'var(--color-voice-amber)',
  amberSoft: 'var(--color-voice-amber-soft)',
  light: 'var(--color-voice-light)',
  soft: 'var(--color-voice-soft)',
  ink: 'var(--color-voice-ink)',
  muted: 'var(--color-voice-muted)',
  faint: 'var(--color-voice-faint)',
  ok: 'var(--color-voice-ok)',
  okSoft: 'var(--color-voice-ok-soft)',
  grey: 'var(--color-voice-muted-bg)',
  white: 'var(--color-surface)',
};

export const DEFAULT_TUTOR_IMAGE = '/brand/favicon.png';
const BAR_COUNT = 30;
const ENDTURN_MS = 1100;

export const LANGUAGES: { value: VoiceLanguage; label: string; glyph: string; hint: string }[] = [
  { value: 'english', label: 'English', glyph: 'Aa', hint: 'Explained fully in English' },
  { value: 'hinglish', label: 'Hinglish', glyph: 'Aअ', hint: 'Hindi + English mix' },
  { value: 'hindi', label: 'हिंदी', glyph: 'अ', hint: 'पूरी तरह हिंदी में' },
];

interface SurfaceCopy {
  checking: string;
  thinkingHelper: string;
  back: string;
  source?: string;
  suggestions: string[];
}

// Lecture tutors answer from the open lecture; the dashboard tutor covers the whole syllabus; the assessment
// tutor talks about one evaluated question. NEET surfaces never mention NCERT / CBSE books.
const SURFACE_COPY: Record<'lecture' | 'dashboard' | 'assessment' | 'neetLecture' | 'neetDashboard' | 'neetAssessment', SurfaceCopy> = {
  lecture: {
    checking: 'Checking this lecture',
    thinkingHelper: 'Checking this lecture and your NCERT book',
    back: 'Minimise and go back to the lecture',
    source: 'Source: CBSE Textbook',
    suggestions: ['“Explain the last part again”', '“Give me an example”', '“Quiz me”'],
  },
  dashboard: {
    checking: 'Checking your NCERT book',
    thinkingHelper: 'Checking your NCERT book',
    back: 'Minimise live talk',
    source: 'Source: CBSE Textbook',
    suggestions: ['“Explain a topic I’m stuck on”', '“Give me an example”', '“Quiz me”'],
  },
  assessment: {
    checking: 'Reading your answer',
    thinkingHelper: 'Checking your answer against the model answer',
    back: 'Minimise and go back to the chat',
    source: 'Based on your answer',
    suggestions: ['“Where did I lose marks?”', '“Explain the right answer”', '“How do I write it for full marks?”'],
  },
  neetLecture: {
    checking: 'Checking this NEET lecture',
    thinkingHelper: 'Checking this lecture',
    back: 'Minimise and go back to the lecture',
    suggestions: ['“Explain the last part again”', '“Give me an example”', '“Quiz me”'],
  },
  neetDashboard: {
    checking: 'Checking your NEET syllabus',
    thinkingHelper: 'Checking your NEET syllabus',
    back: 'Minimise live talk',
    suggestions: ['“Explain a topic I’m stuck on”', '“Give me an example”', '“Quiz me”'],
  },
  neetAssessment: {
    checking: 'Reading your answer',
    thinkingHelper: 'Checking your option against the explanation',
    back: 'Minimise and go back to the chat',
    suggestions: ['“Why is my option wrong?”', '“Explain the right answer”', '“Give me a trick to remember this”'],
  },
};

export function phaseCopy(phase: VoicePhase, name: string, thinkingHelper: string): { title: string; helper: string; hint: string } {
  switch (phase) {
    case 'connecting':
      return { title: 'Getting ready', helper: `Connecting you to ${name}`, hint: 'Getting ready…' };
    case 'listening':
      return { title: 'Your turn', helper: 'Ask anything. I’ll answer when you pause.', hint: 'Just start talking' };
    case 'speaking':
      return { title: 'Listening…', helper: 'Take your time. Pause when you’re done.', hint: 'Pause when you’re done' };
    case 'endturn':
      return { title: 'Got it', helper: 'You paused, so I’m sending your question', hint: 'Sending your question…' };
    case 'thinking':
      return { title: 'Thinking…', helper: thinkingHelper, hint: 'Speak anytime to add more' };
    case 'answering':
      return { title: `${name} is explaining`, helper: 'Start speaking anytime to interrupt', hint: 'Speak anytime to interrupt' };
    case 'interrupted':
      return { title: 'I’m listening', helper: 'I stopped so you can speak', hint: 'Go ahead, you have the floor' };
    default:
      return { title: '', helper: '', hint: '' };
  }
}

export interface LiveTalkScreenProps {
  /** "Type" / "Type your doubt instead": go back to the text chat. */
  onType: () => void;
  /** The chat panel is expanded to full screen: cover all of it. */
  expanded?: boolean;
  /** Sit exactly over a right-hand chat drawer instead of the chat panel. */
  drawer?: boolean;
}

/** The full-screen live talk: tutor photo with listening / speaking animations, captions, answer and controls. */
export function LiveTalkScreen({ onType, expanded = false, drawer = false }: LiveTalkScreenProps) {
  const voice = useLiveVoice();
  const { t, mic, bot } = useVoiceLevels(!!voice?.screenOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const captionRef = useRef<HTMLDivElement | null>(null);

  // When the phase last changed, for the "pause detected" ring and the connect checklist.
  const phase = voice?.phase ?? 'idle';
  const [phaseSince, setPhaseSince] = useState(() => ({ phase, at: performance.now() }));
  if (phaseSince.phase !== phase) setPhaseSince({ phase, at: performance.now() });
  const inPhaseMs = performance.now() - phaseSince.at;

  useEffect(() => {
    // While the tutor answers, SpokenText keeps the highlighted word in view instead.
    if (phase === 'answering') return;
    const el = captionRef.current;
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
  }, [phase, voice?.interimText]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close the language menu when the screen is minimised, so it isn't still open on return.
  const screenOpen = !!voice?.screenOpen;
  const [wasOpen, setWasOpen] = useState(screenOpen);
  if (wasOpen !== screenOpen) {
    setWasOpen(screenOpen);
    if (!screenOpen) setMenuOpen(false);
  }

  // Minimised during a call, the screen stays mounted but hidden: unmounting would reset the word
  // highlighter, which would then restart the last answer from its first word on reopening.
  if (!voice || (!voice.screenOpen && !voice.isActive)) return null;
  const minimised = !voice.screenOpen;

  const { name } = splitAvatarName(voice.avatar?.name);
  const image = voice.avatar?.image || DEFAULT_TUTOR_IMAGE;
  const isError = phase === 'error';
  const surface =
    SURFACE_COPY[
      voice.variant === 'neet-post-assessment'
        ? 'neetAssessment'
        : voice.variant === 'neet-dashboard'
          ? 'neetDashboard'
          : voice.variant === 'neet-lecture'
            ? 'neetLecture'
            : voice.variant === 'post-assessment'
              ? 'assessment'
              : isDashboardVariant(voice.variant)
                ? 'dashboard'
                : 'lecture'
    ];
  const copy = phaseCopy(phase, name, surface.thinkingHelper);
  // Muted: no amber "we hear you" visuals at all, just a still, muted state.
  const muted = voice.muted;
  const studentOn = !muted && (phase === 'speaking' || phase === 'interrupted');
  const listening = !muted && phase === 'listening';
  const level = studentOn ? mic : phase === 'answering' ? bot : 0;
  const endP = Math.min(1, inPhaseMs / ENDTURN_MS);
  // The finished answer stays up during "Your turn" so the student can still read it.
  const showReply = phase === 'answering' || (phase === 'listening' && !!voice.reply);

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    let h = 4;
    let c = C.light;
    let o = 1;
    if (studentOn) {
      h = 4 + 40 * waveAmp(i, t, BAR_COUNT) * Math.max(0.15, level);
      c = C.amber;
    } else if (phase === 'endturn' && !muted) {
      h = 4 + 30 * waveAmp(i, t, BAR_COUNT) * Math.max(0, 1 - endP * 1.3);
      c = C.amber;
    } else if (phase === 'answering') {
      h = 4 + 36 * waveAmp(i, t + 1.7, BAR_COUNT) * Math.max(0.2, level);
      c = C.purple;
    } else if (listening) {
      h = 4 + 5 * (0.5 + 0.5 * Math.sin(t * 5 + i * 0.9));
      c = C.amber;
      o = 0.7;
    } else if (phase === 'thinking' || phase === 'connecting') {
      const pos = ((t * 16) % (BAR_COUNT + 10)) - 5;
      h = 4 + 10 * Math.max(0, Math.cos((i - pos) * 0.35)) * (Math.abs(i - pos) < 4.5 ? 1 : 0);
      c = C.purple;
      o = 0.45;
    }
    return { h, c, o };
  });

  const ring = (s: number, o: number, c: string, bw = 2) => ({ s, o, c, bw });
  let rings = [ring(1, 0, C.light), ring(1, 0, C.light), ring(1, 0, C.light)];
  if (listening)
    rings = [ring(0.9 + 0.03 * Math.sin(t * 2.2), 0.9, C.amber), ring(0.98 + 0.03 * Math.sin(t * 2.2 - 0.8), 0.3, C.amber), ring(1, 0, C.amber)];
  else if (studentOn)
    rings = [ring(0.87 + 0.28 * level, 0.95, C.amber, 3), ring(0.9 + 0.48 * level, 0.45, C.amber), ring(0.93 + 0.68 * level, 0.2, C.amber)];
  else if (phase === 'answering')
    rings = [0, 1, 2].map((k) => {
      const ph = (t * 0.6 + k / 3) % 1;
      return ring(0.84 + 0.24 * ph + 0.04 * level, (1 - ph) * 0.85, C.purple);
    });
  else if (phase === 'thinking') rings = [ring(0.9, 1, C.light, 3), ring(1, 0, C.light), ring(1, 0, C.light)];
  else if (phase === 'endturn' && !muted) rings = [ring(0.88, 0.35, C.amber), ring(1, 0, C.amber), ring(1, 0, C.amber)];

  let badge: { bg: string; fg: string; icon: React.ReactNode; label: string } | null = null;
  if (muted && phase !== 'answering' && phase !== 'thinking' && phase !== 'connecting')
    badge = { bg: C.grey, fg: C.muted, icon: <MicOffIcon />, label: 'muted' };
  else if (listening || studentOn) badge = { bg: C.amber, fg: C.ink, icon: <MicIcon />, label: 'mic' };
  else if (phase === 'endturn') badge = { bg: C.ok, fg: C.white, icon: <CheckIcon />, label: 'sent' };
  else if (phase === 'thinking') badge = { bg: C.purple, fg: C.white, icon: <DotsIcon />, label: 'thinking' };
  else if (phase === 'answering') badge = { bg: C.purple, fg: C.white, icon: <SpeakerIcon />, label: 'speaking' };

  const meter = [0, 1, 2, 3, 4].map((i) => {
    if (studentOn) return { h: 4 + 12 * waveAmp(i * 6 + 3, t, BAR_COUNT) * Math.max(0.2, level), c: C.amber };
    if (listening) return { h: 4 + 3 * (0.5 + 0.5 * Math.sin(t * 5 + i)), c: C.amber };
    if (phase === 'answering') return { h: 4 + 14 * waveAmp(i * 6 + 3, t + 1.7, BAR_COUNT) * Math.max(0.2, level), c: C.purple };
    return { h: 4, c: C.light };
  });

  const cursorOn = Math.floor(t * 4) % 2 === 0;
  const lastSpoken = splitReply(voice.lastReply?.text || '').spoken;
  const lastReplyTail = lastSpoken.length > 60 ? `…${lastSpoken.slice(-60)}` : lastSpoken;
  const currentLang = LANGUAGES.find((l) => l.value === voice.language) ?? LANGUAGES[0]!;

  const prepSteps = [
    { label: 'Microphone is working', done: inPhaseMs > 400 },
    { label: surface.checking, done: inPhaseMs > 1400 },
    { label: `Connecting to ${name}`, done: false },
  ];
  const activePrep = prepSteps.findIndex((s) => !s.done);
  const hidden = minimised ? { display: 'none' } : undefined;

  const controlButton = 'flex w-[76px] flex-col items-center gap-1 py-1 text-[12px] font-medium text-brand disabled:opacity-40';
  const controlTile = 'flex size-12 items-center justify-center rounded-[12px]';

  return (
    <>
      {/* Same backdrop + panel geometry as the text chat, so switching feels like one window. */}
      <div aria-hidden className="bg-night-900/30 fixed inset-0 z-[119] backdrop-blur-sm" style={hidden} onClick={voice.minimise} />
      <div
        style={hidden}
        aria-hidden={minimised || undefined}
        role="dialog"
        aria-label={`Live talk with ${name}`}
        className={cx(
          'bg-surface text-voice-ink fixed z-[120] flex flex-col overflow-hidden font-sans shadow-lg',
          drawer
            ? 'inset-0 w-full md:left-auto md:max-w-[460px]'
            : expanded
              ? 'inset-0 rounded-lg'
              : 'inset-0 w-full rounded-lg md:inset-y-4 md:right-4 md:left-auto md:w-[45%]',
        )}
      >
        {/* Equal-width side columns keep the name centred though the language pill is wider than the back button. */}
        <header className="flex h-[64px] flex-none items-center gap-1 px-1">
          <div className="flex flex-1 basis-0 justify-start">
            <button
              type="button"
              aria-label={surface.back}
              onClick={voice.minimise}
              className="text-voice-ink hover:bg-voice-soft flex size-12 flex-none items-center justify-center rounded-[12px]"
            >
              <ChevronIcon />
            </button>
          </div>
          <div className="flex max-w-[50%] min-w-0 flex-none flex-col items-center">
            <div className="max-w-full truncate text-[16px] font-semibold">{name}</div>
            {!isError && (
              <div className="text-voice-muted flex items-center gap-[6px] text-[12px]">
                <span className="size-2 rounded-full" style={{ background: phase === 'connecting' ? C.purple : C.ok }} />
                <span className="text-voice-ink font-semibold">{phase === 'connecting' ? 'Connecting' : 'Live'}</span>
                {phase !== 'connecting' && <span className="tabular-nums">{formatClock(voice.elapsed)}</span>}
              </div>
            )}
          </div>
          <div className="relative flex flex-1 basis-0 justify-end pr-[6px]">
            <button
              type="button"
              aria-label={`Tutor language: ${currentLang.label}. Change language`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={cx(
                'flex h-[36px] flex-none items-center gap-[6px] rounded-full border pr-[8px] pl-[10px] text-[13px] font-semibold transition-colors duration-150',
                menuOpen
                  ? 'border-brand bg-brand text-on-brand shadow-voice-pill'
                  : 'border-voice-line bg-voice-soft text-brand hover:border-voice-line-hover hover:bg-voice-light',
              )}
            >
              <span aria-hidden className="flex items-center max-[380px]:hidden">
                <LanguageIcon size={16} />
              </span>
              <span className="whitespace-nowrap">{currentLang.label}</span>
              <ChevronIcon size={14} strokeWidth={2.6} className={cx('transition-transform duration-200', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen && (
              <>
                <div aria-hidden className="fixed inset-0 z-[1]" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  aria-label="Tutor language"
                  className="live-lang-menu border-voice-light bg-surface shadow-voice-menu absolute top-[46px] right-[6px] z-[2] w-[256px] rounded-lg border p-[6px]"
                >
                  <div className="text-voice-faint px-[10px] pt-[8px] pb-[6px] text-[11px] font-semibold tracking-[0.6px] uppercase">Tutor speaks in</div>
                  {LANGUAGES.map((l) => {
                    const selected = voice.language === l.value;
                    return (
                      <button
                        key={l.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          voice.setLanguage(l.value);
                          setMenuOpen(false);
                        }}
                        className={cx(
                          'flex w-full items-center gap-[12px] rounded-[12px] px-[8px] py-[8px] text-left transition-colors duration-150',
                          selected ? 'bg-voice-soft' : 'hover:bg-voice-page',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cx(
                            'flex size-[38px] flex-none items-center justify-center rounded-[10px] text-[15px] font-semibold',
                            selected ? 'bg-brand text-on-brand' : 'bg-voice-soft text-brand',
                          )}
                        >
                          {l.glyph}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={cx('text-[14px] leading-[1.3] font-semibold', selected ? 'text-brand' : 'text-voice-ink')}>{l.label}</span>
                          <span className="text-voice-faint truncate text-[12px] leading-[1.4]">{l.hint}</span>
                        </span>
                        {selected ? (
                          <span aria-hidden className="bg-brand text-on-brand flex size-[20px] flex-none items-center justify-center rounded-full">
                            <CheckIcon size={12} strokeWidth={3.4} />
                          </span>
                        ) : (
                          <span aria-hidden className="border-voice-radio size-[20px] flex-none rounded-full border-2" />
                        )}
                      </button>
                    );
                  })}
                  {voice.isActive && (
                    <div className="bg-voice-amber-soft text-voice-amber-text mx-[2px] mt-[6px] mb-[2px] flex items-start gap-[8px] rounded-[10px] px-[10px] py-[8px] text-[11px] leading-[1.45]">
                      <InfoIcon className="mt-px flex-none" />
                      <span>Changing it reconnects the live talk.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {isError ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-7 text-center">
            <span className="bg-voice-danger-soft text-voice-danger flex size-[72px] items-center justify-center rounded-full">
              <WarningIcon />
            </span>
            <div role="alert" className="flex flex-col gap-1">
              <div className="text-[20px] font-semibold">{voice.error?.title}</div>
              <p className="text-voice-muted m-0 text-[14px] leading-[1.55]">{voice.error?.message}</p>
            </div>
            <div className="flex w-full max-w-[320px] flex-col gap-2">
              {voice.error?.retryable && (
                <button type="button" onClick={voice.retry} className="bg-brand text-on-brand h-[52px] rounded-[12px] text-[15px] font-semibold">
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  voice.minimise();
                  onType();
                }}
                className="text-brand h-12 rounded-[12px] text-[14px] font-semibold"
              >
                Type your doubt instead
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Avatar + status. While an answer is up this keeps its natural height and the answer takes the rest. */}
            <div className={cx('flex flex-col items-center justify-center overflow-hidden', showReply ? 'flex-none gap-2 pb-2 md:gap-3' : 'min-h-0 flex-1 gap-4')}>
              <div
                aria-hidden
                data-badge={badge?.label}
                className={cx(
                  'relative size-[252px] flex-none transition-transform duration-300',
                  // Negative margins take back the space the scaled-down box no longer uses: 252 * (1 - scale) / 2.
                  showReply
                    ? '-my-[72px] scale-[0.425] md:-my-[51px] md:scale-[0.595]'
                    : '-my-[19px] scale-[0.85] [@media(max-height:740px)]:-my-[42px] [@media(max-height:740px)]:scale-[0.663]',
                )}
              >
                <div
                  className="absolute top-[28px] left-[28px] size-[196px] rounded-full transition-colors duration-300"
                  style={{ background: phase === 'answering' || phase === 'thinking' || phase === 'connecting' ? C.soft : C.amberSoft }}
                />
                {rings.map((r, i) => (
                  <div
                    key={i}
                    className="absolute top-[6px] left-[6px] size-[240px] rounded-full"
                    style={{ border: `${r.bw}px solid ${r.c}`, transform: `scale(${r.s.toFixed(3)})`, opacity: r.o, transition: 'transform 120ms linear, opacity 160ms linear' }}
                  />
                ))}
                {phase === 'connecting' && (
                  <svg width="252" height="252" viewBox="0 0 252 252" className="absolute top-0 left-0" style={{ transform: `rotate(${(t * 70) % 360}deg)` }}>
                    <circle cx="126" cy="126" r="116" fill="none" stroke={C.purple} strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" />
                  </svg>
                )}
                {phase === 'endturn' && (
                  <svg width="252" height="252" viewBox="0 0 252 252" className="absolute top-0 left-0">
                    <circle cx="126" cy="126" r="116" fill="none" stroke={C.amberSoft} strokeWidth="7" />
                    <circle
                      cx="126"
                      cy="126"
                      r="116"
                      fill="none"
                      stroke={C.amber}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray="729"
                      strokeDashoffset={729 * (1 - endP)}
                      transform="rotate(-90 126 126)"
                    />
                  </svg>
                )}
                {phase === 'thinking' &&
                  [0, 1, 2, 3].map((k) => {
                    const a = t * 2.6 - k * 0.32;
                    const size = 12 - k * 2;
                    return (
                      <span
                        key={k}
                        className="absolute rounded-full"
                        style={{ left: 126 + 114 * Math.cos(a) - size / 2, top: 126 + 114 * Math.sin(a) - size / 2, width: size, height: size, background: C.purple, opacity: 1 - k * 0.22 }}
                      />
                    );
                  })}
                {/* eslint-disable-next-line @next/next/no-img-element -- tutor photos come from the backend's CDN */}
                <img
                  src={image}
                  alt=""
                  onError={(event) => {
                    if (!event.currentTarget.src.endsWith(DEFAULT_TUTOR_IMAGE)) event.currentTarget.src = DEFAULT_TUTOR_IMAGE;
                  }}
                  className="border-surface shadow-voice-avatar absolute top-[56px] left-[56px] size-[140px] rounded-full border-4 object-cover"
                  style={{ transform: `scale(${phase === 'answering' ? 1 + 0.04 * level : 1})`, transition: 'transform 120ms linear' }}
                />
                {badge && (
                  <span
                    className="border-surface absolute top-[164px] left-[166px] flex size-12 items-center justify-center rounded-full border-[3px]"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    {badge.icon}
                  </span>
                )}
              </div>
              <div role="status" className="flex flex-col items-center gap-[2px] px-7 text-center">
                <div className={cx('leading-[1.3] font-semibold', showReply ? 'text-[18px] md:text-[20px]' : 'text-[20px] md:text-[22px]')}>{copy.title}</div>
                {/* The hint pill repeats this on phones, where the answer needs the room. */}
                <div className={cx('text-voice-muted text-[14px] leading-[1.5]', showReply && 'max-md:hidden')}>
                  {voice.muted ? 'You’re muted. Unmute to ask.' : copy.helper}
                </div>
              </div>
              <div aria-hidden className={cx('flex h-[44px] items-center gap-1', showReply && 'max-md:hidden')}>
                {bars.map((b, i) => (
                  <span key={i} className="block w-[3px] rounded-[2px]" style={{ height: b.h, background: b.c, opacity: b.o, transition: 'height 110ms linear' }} />
                ))}
              </div>
            </div>

            {/* Captions. No justify-end while an answer is up: overflowing content would spill off the top. */}
            <div
              ref={captionRef}
              className={cx('flex flex-col overflow-y-auto px-6 pb-[10px]', showReply ? 'min-h-0 flex-1' : 'max-h-[38vh] min-h-[120px] flex-none justify-end')}
            >
              {phase === 'connecting' && (
                <div className="bg-voice-page flex flex-col gap-[10px] rounded-lg p-[14px]">
                  {prepSteps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-[10px] text-[13px]" style={{ color: step.done || i === activePrep ? C.ink : C.faint }}>
                      {step.done ? (
                        <span className="bg-voice-ok text-on-brand flex size-5 flex-none items-center justify-center rounded-full">
                          <CheckIcon size={12} strokeWidth={3.4} />
                        </span>
                      ) : (
                        <span className="size-5 flex-none rounded-full border-2" style={{ borderColor: i === activePrep ? C.purple : C.light }} />
                      )}
                      <span style={{ fontWeight: i === activePrep ? 600 : 400 }}>{step.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {phase === 'listening' && !voice.reply && (
                <div className="flex flex-col gap-2">
                  <div className="text-voice-muted text-[12px]">Not sure how to start? Try saying</div>
                  <div className="flex flex-wrap gap-2">
                    {surface.suggestions.map((s) => (
                      <span key={s} className="border-voice-light bg-surface text-brand flex h-11 items-center rounded-[12px] border px-4 text-[13px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(phase === 'speaking' || phase === 'endturn') && (
                <div className="bg-voice-amber-soft flex min-h-[112px] flex-col gap-1 rounded-lg px-[14px] pt-4 pb-[14px]">
                  <div className="text-voice-muted flex items-center gap-[6px] text-[11px] font-semibold">
                    <span className="bg-voice-amber size-[7px] rounded-full" />
                    <span className="flex-1">You</span>
                    <span className="font-medium">{phase === 'endturn' ? 'Sending' : 'Live caption'}</span>
                  </div>
                  <div className="text-[16px] leading-[1.5]">
                    {phase === 'endturn' ? voice.lastUserText : voice.interimText}
                    {phase === 'speaking' && (
                      <span className="bg-voice-amber ml-[2px] inline-block h-[18px] w-[2px] align-[-3px]" style={{ opacity: cursorOn ? 1 : 0 }} />
                    )}
                  </div>
                </div>
              )}

              {phase === 'thinking' && (
                <div className="flex flex-col gap-2">
                  {voice.lastUserText && (
                    <div className="bg-voice-page text-voice-muted rounded-[14px] px-[14px] py-[10px] text-[13px] leading-[1.5]">
                      <span className="text-voice-ink font-semibold">You asked: </span>
                      {voice.lastUserText}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-[6px]">
                    <span className="bg-voice-ok-soft text-voice-ink flex h-8 items-center gap-[6px] rounded-full px-[10px] text-[12px] font-medium">
                      <CheckIcon size={12} strokeWidth={3.4} className="text-voice-ok" />
                      Understood
                    </span>
                    <span className="bg-voice-soft text-brand flex h-8 items-center gap-[6px] rounded-full px-[10px] text-[12px] font-medium">{surface.checking}…</span>
                  </div>
                </div>
              )}

              {showReply && (
                <div className="border-voice-light bg-voice-soft flex min-h-[112px] flex-1 flex-col gap-1 rounded-lg border px-4 pt-[10px] pb-4 md:min-h-[132px] md:px-[14px] md:pt-3 md:pb-[14px]">
                  <div className="text-voice-muted flex flex-none items-center gap-[6px] text-[11px] font-semibold">
                    <span className="bg-brand size-[7px] rounded-full" />
                    <span className="flex-1">
                      {name} {voice.tutorPaused ? '· paused' : phase === 'answering' ? 'is speaking' : 'said'}
                    </span>
                    {surface.source && <span className="text-brand font-medium">{surface.source}</span>}
                  </div>
                  {voice.reply?.text || voice.reply?.figure ? (
                    // Scrolls on its own (header stays put); SpokenText keeps the line being read in view.
                    <div data-spoken-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      <SpokenText replyId={voice.reply.id} text={voice.reply.text} done={!!voice.reply.done} />
                      <VoiceReplyText hideSpoken text={voice.reply.text} figure={voice.reply.figure} />
                    </div>
                  ) : (
                    <span className="text-voice-faint text-[14px]">…</span>
                  )}
                </div>
              )}

              {phase === 'interrupted' && (
                <div className="flex flex-col gap-2">
                  <div className="text-voice-faint flex items-center gap-2 text-[12px]">
                    <span className="flex-1 truncate">{lastReplyTail ? `${name}: ${lastReplyTail}` : ''}</span>
                    <span className="bg-voice-soft text-brand flex-none rounded-[6px] px-2 py-[2px] font-semibold">Stopped for you</span>
                  </div>
                  <div className="bg-voice-amber-soft flex flex-col gap-1 rounded-lg px-[14px] pt-4 pb-[14px]">
                    <div className="text-voice-muted flex items-center gap-[6px] text-[11px] font-semibold">
                      <span className="bg-voice-amber size-[7px] rounded-full" />
                      <span className="flex-1">You</span>
                      <span className="font-medium">Live caption</span>
                    </div>
                    <div className="text-[16px] leading-[1.5]">
                      {voice.interimText}
                      <span className="bg-voice-amber ml-[2px] inline-block h-[18px] w-[2px] align-[-3px]" style={{ opacity: cursorOn ? 1 : 0 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hint pill */}
            <div className="flex flex-none justify-center px-6 pb-[10px]">
              <div aria-live="polite" className="border-voice-light bg-voice-page relative flex h-10 items-center gap-2 overflow-hidden rounded-full border px-6">
                <span
                  className="bg-voice-amber-soft absolute top-0 bottom-0 left-0"
                  style={{ width: `${phase === 'endturn' && !muted ? endP * 100 : 0}%`, transition: 'width 110ms linear' }}
                />
                {muted ? (
                  <span aria-hidden className="text-voice-muted relative flex h-[18px] items-center">
                    <MicOffIcon size={16} />
                  </span>
                ) : (
                  <span aria-hidden className="relative flex h-[18px] items-center gap-[2px]">
                    {meter.map((m, i) => (
                      <span key={i} className="block w-[3px] rounded-[2px]" style={{ height: m.h, background: m.c, transition: 'height 110ms linear' }} />
                    ))}
                  </span>
                )}
                <span className="relative text-[13px] font-medium whitespace-nowrap">{muted ? 'Muted' : copy.hint}</span>
              </div>
            </div>
          </>
        )}

        {/* Controls */}
        <div className="border-voice-light flex flex-none flex-col gap-[2px] border-t px-6 pt-2 pb-[max(6px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-around">
            <button type="button" aria-pressed={voice.muted} disabled={isError || phase === 'connecting'} onClick={voice.toggleMute} className={controlButton}>
              <span className={controlTile} style={{ background: voice.muted ? C.purple : C.soft, color: voice.muted ? C.white : C.purple }}>
                {voice.muted ? <MicOffStandIcon /> : <MicStandIcon />}
              </span>
              {voice.muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              type="button"
              aria-pressed={voice.tutorPaused}
              aria-label={voice.tutorPaused ? `Resume ${name}'s voice` : `Pause ${name}'s voice`}
              disabled={phase !== 'answering'}
              onClick={voice.toggleTutorAudio}
              className={controlButton}
            >
              <span className={controlTile} style={{ background: voice.tutorPaused ? C.purple : C.soft, color: voice.tutorPaused ? C.white : C.purple }}>
                {voice.tutorPaused ? <PlayIcon /> : <PauseIcon />}
              </span>
              {voice.tutorPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => {
                voice.minimise();
                onType();
              }}
              className={controlButton}
            >
              <span className={cx(controlTile, 'bg-voice-soft text-brand')}>
                <KeyboardIcon />
              </span>
              Type
            </button>
            <button
              type="button"
              onClick={() => {
                if (isError) return voice.minimise();
                const hadConversation = voice.turns.length > 0 || !!voice.reply;
                voice.end();
                // "Session ended, saved to chat": land on the chat thread where the summary card is.
                if (hadConversation) onType();
              }}
              className={controlButton}
            >
              <span className={cx(controlTile, 'bg-voice-danger text-on-brand')}>
                <HangUpIcon />
              </span>
              {isError ? 'Close' : 'End'}
            </button>
          </div>
          <div className="text-voice-faint text-center text-[11px]">Prepzy can make mistakes.</div>
        </div>
      </div>
    </>
  );
}
