'use client';

import { cx } from '@prepzy/design-system';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveVoice } from '../provider';
import { splitReply, tokenizeSpoken, type SpokenToken } from '../text';
import type { WordTiming } from '../types';
import { MathText } from './voice-reply-text';

// The voice service usually sends no word timings, so the position is estimated from the tutor's audio:
// it advances while she is audible, re-syncs to the nearest comma / full stop whenever her voice pauses,
// and learns her real speaking speed from each stretch between pauses.
const TICK_MS = 50;
const AUDIBLE_LEVEL = 0.04;
/** Short dips between words and consonants still count as speech. */
const HANGOVER_MS = 200;
/** A silence this long is a real pause in the voice (end of a sentence or clause). */
const GAP_MS = 320;
/** Re-sync only to a pause point within this many seconds of speech from the estimate… */
const SNAP_WINDOW_SEC = 2.5;
/** …or one that means she spoke up to this many times faster / slower than estimated. */
const SNAP_MAX_RATIO = 2.5;
/** The timer fires late while the page is busy; never count more than this per tick. */
const MAX_TICK_MS = 250;
/** Ignore stretches too short to measure the speed from reliably. */
const MIN_MEASURE_MS = 700;
/** Reached a sentence end but the voice keeps going without pausing: move on after this. */
const MAX_HOLD_MS = 1200;
/** Nudge past a pause point once it's been reached for real. */
const PASSED = 0.001;
/** Once all text is in, this much silence after speaking means she has finished reading it. */
const FINISHED_SILENCE_MS = 2000;

/** Speed in "units" per second: roughly letters, plus a little per word gap and punctuation pause. */
const START_RATE: Record<string, number> = { english: 17, hinglish: 16, hindi: 15 };
const MIN_RATE = 6;
const MAX_RATE = 45;
/** Learned speed carries over to the next answer in the same language. */
const learnedRate: Record<string, number> = {};

const PUNCTUATION_RE = /[.,;:!?।॥"'“”‘’()[\]{}—–-]/g;
const CLAUSE_END_RE = /[,;:—–]["'”’)]*$/;
const SENTENCE_END_RE = /[.?!।॥]["'”’)]*$/;

function tokenWeight(token: SpokenToken) {
  // A formula takes longer to say than a word, but not in proportion to its LaTeX source.
  if (token.kind === 'math') return Math.min(40, 10 + token.text.length * 0.3);
  const letters = token.text.replace(PUNCTUATION_RE, '').length;
  const pause = SENTENCE_END_RE.test(token.text) ? 8 : CLAUSE_END_RE.test(token.text) ? 4 : 0;
  return Math.max(2, letters) + 2 + pause;
}

interface PausePoint {
  at: number;
  sentence: boolean;
}

interface Layout {
  ends: number[];
  pauses: PausePoint[];
  total: number;
}

/** Position from the service's speaking times (null when it sent none). */
export function timedPosition(anchors: WordTiming['anchors'], playMs: number, { ends, pauses, total }: Layout, fallbackRate: number) {
  if (!anchors.length || !ends.length) return null;
  const posOf = (index: number) => (index > 0 ? ends[Math.min(index, ends.length) - 1]! : 0);
  // Our clock starts at her first audible sound, which is where the first word starts.
  const t = playMs + (anchors[0]!.index === 0 ? anchors[0]!.ms : 0);
  let i = -1;
  while (i + 1 < anchors.length && anchors[i + 1]!.ms <= t) i++;
  if (i === -1) return 0;
  const a = anchors[i]!;
  const b = anchors[i + 1];
  if (b && b.ms > a.ms) return posOf(a.index) + (posOf(b.index) - posOf(a.index)) * ((t - a.ms) / (b.ms - a.ms));
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  const measured = last.ms > first.ms ? (posOf(last.index) - posOf(first.index)) / ((last.ms - first.ms) / 1000) : 0;
  const rate = measured > 0 ? Math.min(MAX_RATE, Math.max(MIN_RATE, measured)) : fallbackRate;
  const from = posOf(a.index);
  const cap = pauses.find((p) => p.sentence && p.at > from)?.at ?? total;
  return Math.min(cap, from + (rate * (t - a.ms)) / 1000);
}

/** Memoised so moving the highlight never re-typesets a formula. */
const MathToken = memo(function MathToken({ tex }: { tex: string }) {
  return <MathText text={tex} className="inline-block" />;
});

/** The tutor's answer, word by word, with the word she is saying highlighted. */
export function SpokenText({ replyId, text, done = false }: { replyId: number; text: string; done?: boolean }) {
  const voice = useLiveVoice();
  const meters = voice?.meters;
  const tokens = useMemo(() => tokenizeSpoken(splitReply(text).spoken), [text]);

  const layout = useMemo<Layout>(() => {
    let acc = 0;
    const ends: number[] = [];
    const pauses: PausePoint[] = [];
    tokens.forEach((token) => {
      acc += tokenWeight(token);
      ends.push(acc);
      if (token.kind === 'math' ? token.display : SENTENCE_END_RE.test(token.text)) pauses.push({ at: acc, sentence: true });
      else if (token.kind === 'word' && CLAUSE_END_RE.test(token.text)) pauses.push({ at: acc, sentence: false });
    });
    if (done && acc > 0 && pauses[pauses.length - 1]?.at !== acc) pauses.push({ at: acc, sentence: true });
    return { ends, pauses, total: acc };
  }, [tokens, done]);

  const layoutRef = useRef(layout);
  const doneRef = useRef(done);
  const languageRef = useRef(voice?.language ?? 'english');
  const pausedRef = useRef(false);
  const replyIdRef = useRef(replyId);
  useEffect(() => {
    layoutRef.current = layout;
    doneRef.current = done;
    languageRef.current = voice?.language ?? 'english';
    pausedRef.current = !!voice?.tutorPaused;
    replyIdRef.current = replyId;
  });

  const track = useRef({ pos: 0, segStart: 0, segAudibleMs: 0, silenceMs: 0, holdMs: 0, gapHandled: false, spoke: false, rate: 0, playMs: 0 });
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const lang = languageRef.current;
    track.current = {
      pos: 0,
      segStart: 0,
      segAudibleMs: 0,
      silenceMs: 0,
      holdMs: 0,
      gapHandled: false,
      spoke: false,
      rate: learnedRate[lang] ?? START_RATE[lang] ?? START_RATE.english!,
      playMs: 0,
    };
    setCurrent(0);
    setFinished(false);
  }, [replyId]);

  useEffect(() => {
    if (!meters) return;
    let lastTick = performance.now();
    const id = setInterval(() => {
      // Advance by the time that really passed, not the nominal tick.
      const now = performance.now();
      const dt = Math.min(MAX_TICK_MS, Math.max(0, now - lastTick));
      lastTick = now;
      // Paused: the voice is held where she stopped, so the highlight holds on that word too.
      if (pausedRef.current) return;
      const s = track.current;
      const { ends, pauses, total } = layoutRef.current;

      if (meters.levels.bot > AUDIBLE_LEVEL) {
        s.silenceMs = 0;
        s.gapHandled = false;
      } else {
        s.silenceMs += dt;
      }
      if (s.spoke) s.playMs += dt;

      if (s.silenceMs < HANGOVER_MS) {
        s.spoke = true;
        s.segAudibleMs += dt;
        // Don't run past the end of the current sentence until the voice actually pauses there.
        const cap = pauses.find((p) => p.sentence && p.at >= s.pos)?.at ?? total;
        const next = s.pos + (s.rate * dt) / 1000;
        if (next < cap) {
          s.pos = next;
          s.holdMs = 0;
        } else {
          s.pos = cap;
          s.holdMs += dt;
          if (s.holdMs > MAX_HOLD_MS) {
            s.pos = Math.min(total, cap + PASSED);
            s.holdMs = 0;
          }
        }
      } else if (s.silenceMs >= GAP_MS && !s.gapHandled && s.spoke) {
        s.gapHandled = true;
        // The voice paused: snap to the comma / full stop that best fits how far she has got, and learn the speed.
        const window = s.rate * SNAP_WINDOW_SEC;
        const expected = s.pos - s.segStart;
        const spokenSec = s.segAudibleMs / 1000;
        let best: PausePoint | null = null;
        let bestScore = Infinity;
        for (const p of pauses) {
          const covered = p.at - s.segStart;
          if (covered <= 0) continue;
          const score = expected > 0 ? Math.abs(Math.log(covered / expected)) : Math.abs(p.at - s.pos);
          const inRatio = expected > 0 && score <= Math.log(SNAP_MAX_RATIO);
          if (!inRatio && Math.abs(p.at - s.pos) > window) continue;
          if (s.segAudibleMs >= MIN_MEASURE_MS) {
            const implied = covered / spokenSec;
            if (implied < MIN_RATE || implied > MAX_RATE) continue;
          }
          if (score < bestScore) {
            best = p;
            bestScore = score;
          }
        }
        if (best) {
          if (s.segAudibleMs >= MIN_MEASURE_MS) {
            const measured = (best.at - s.segStart) / spokenSec;
            s.rate = Math.min(MAX_RATE, Math.max(MIN_RATE, s.rate * 0.5 + measured * 0.5));
            learnedRate[languageRef.current] = s.rate;
          }
          s.pos = best.at + PASSED;
          s.segStart = best.at;
          s.segAudibleMs = 0;
          s.holdMs = 0;
        }
      }

      // Speaking times from the service, when it sends them, beat the estimate.
      const timing = meters.wordTiming;
      const timed = timing.replyId === replyIdRef.current ? timedPosition(timing.anchors, s.playMs, layoutRef.current, s.rate) : null;
      let idx = ends.findIndex((end) => end > (timed ?? s.pos));
      if (idx === -1) idx = ends.length - 1;
      setCurrent(idx);
      setFinished(doneRef.current && s.spoke && s.silenceMs >= FINISHED_SILENCE_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [meters]);

  const active = finished ? tokens.length : current;

  // Text arrives ahead of the audio, so follow the highlighted word rather than the end of the text.
  const currentRef = useRef<HTMLSpanElement | null>(null);
  const keepWordInView = (behavior: ScrollBehavior) => {
    const word = currentRef.current;
    // Hidden (screen minimised): nothing to measure; it re-scrolls when the screen reopens.
    if (!word || !word.offsetParent) return;
    const box = word.closest<HTMLElement>('[data-spoken-scroll]');
    if (!box) return word.scrollIntoView?.({ block: 'nearest', behavior });
    // Scroll only when the word's line leaves the upper part of the box, then put it near the top.
    const offset = word.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (offset < 0 || offset > box.clientHeight * 0.6) box.scrollTo?.({ top: box.scrollTop + offset - box.clientHeight * 0.25, behavior });
  };
  useEffect(() => {
    keepWordInView('smooth');
  }, [active]);
  const screenOpen = !!voice?.screenOpen;
  useEffect(() => {
    if (screenOpen) keepWordInView('auto');
  }, [screenOpen]);

  return (
    <p className="m-0 text-[14px] leading-[1.6] md:text-[16px] md:leading-[1.7]" aria-live="off">
      {tokens.map((token, i) => {
        const state = i < active ? 'past' : i === active ? 'now' : 'next';
        return (
          <span
            key={i}
            ref={state === 'now' ? currentRef : undefined}
            data-state={state}
            className={cx(
              'mr-[3px] inline-block rounded-[4px] px-[2px] transition-colors duration-150',
              state === 'now' ? 'bg-voice-light text-brand' : state === 'past' ? 'text-voice-ink' : 'text-voice-faint',
            )}
          >
            {token.kind === 'math' ? <MathToken tex={token.text} /> : token.text}
          </span>
        );
      })}
    </p>
  );
}
