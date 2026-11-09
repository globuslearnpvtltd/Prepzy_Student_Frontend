'use client';

import { cx } from '@prepzy/design-system';
import { Play } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { LiveVoiceLayer, LiveVoiceProvider, useLiveVoice, type VoiceConfig } from '@/features/live-voice';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import type { AtlasSurface } from '../api';
import { OPEN_ATLAS_EVENT, useAtlas } from '../store';
import { ATLAS_IMAGE, SOCRATES_IMAGE } from './chat-kit';
import { AtlasPanel } from './atlas-panel';

const DASHBOARD: AtlasSurface = { kind: 'dashboard' };

/**
 * Pages with their own chat (lecture / chapter steps, which mount the lecture tutor) or none at all
 * (the solver) don't show the dashboard Atlas launcher.
 */
export function showsAtlasLauncher(pathname: string): boolean {
  return !/^\/[^/]+\/(learn\/[^/]+\/[^/]+|doubt-solver)(\/|$)/.test(pathname);
}

/** A chat panel over the page: right-hand card on desktop (or full screen when expanded), full screen on mobile. */
export function ChatOverlay({ open, expanded, onClose, children }: { open: boolean; expanded: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div aria-hidden onClick={onClose} className="bg-night-900/30 fixed inset-0 z-[98] backdrop-blur-sm" />
      <div className={cx('fixed z-[99] flex justify-end', expanded ? 'inset-0' : 'inset-0 w-full md:inset-y-4 md:right-4 md:left-auto md:w-[45%]')}>
        <div className="shadow-socrates-sheet h-full w-full md:rounded-lg">{children}</div>
      </div>
    </>
  );
}

/** Round floating button with the tutor's face (bottom-right). */
export function ChatLauncher({ label, image, onOpen, className }: { label: string; image?: string | null; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onOpen}
      className={cx('bg-brand shadow-brand-glow fixed right-6 bottom-[80px] z-10 size-[60px] overflow-hidden rounded-full md:right-10 md:bottom-10', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image ?? ATLAS_IMAGE} alt="" className="size-full object-cover object-top" />
    </button>
  );
}

/**
 * Dashboard Atlas for every regular page of an exam: floating launcher, the panel, the mobile "Ask" sheet,
 * and the previous app's ways of opening it (`?atlas=1`, the open-Atlas window event).
 */
export function AtlasHost() {
  const exam = useExam();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const { open, expanded, askSheet, openAtlas, close, setExpanded, setAskSheet } = useAtlas();

  useEffect(() => {
    if (params?.get('atlas') !== '1') return;
    openAtlas();
    const next = new URLSearchParams(params.toString());
    next.delete('atlas');
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [params, pathname, router, openAtlas]);

  useEffect(() => {
    window.addEventListener(OPEN_ATLAS_EVENT, openAtlas);
    return () => window.removeEventListener(OPEN_ATLAS_EVENT, openAtlas);
  }, [openAtlas]);

  // Leaving the page closes the sheet (the panel stays open across pages, as before).
  useEffect(() => setAskSheet(false), [pathname, setAskSheet]);

  const launcher = showsAtlasLauncher(pathname);
  const plan = useActivePlan(exam);
  // Board Atlas sends the plan's class; NEET's backend picks the class itself (class_id only feeds the meter).
  const voiceConfig = useMemo<VoiceConfig>(
    () =>
      exam.category === 'competitive'
        ? { variant: 'neet-dashboard', classId: plan.data?.classId ?? null }
        : { variant: 'dashboard', classId: plan.data?.classId ?? null, className: plan.data?.className ?? null },
    [exam.category, plan.data?.classId, plan.data?.className],
  );
  return (
    // The provider lives here so a live talk keeps running while the student moves between pages.
    <LiveVoiceProvider config={voiceConfig}>
      <AtlasLiveLauncher show={launcher && !open} onOpen={openAtlas} />
      <ChatOverlay open={open} expanded={expanded} onClose={close}>
        <AtlasPanel exam={exam} surface={DASHBOARD} expanded={expanded} onExpand={setExpanded} onClose={close} />
      </ChatOverlay>
      <LiveVoiceLayer chatOpen={open} onOpenChat={openAtlas} expanded={expanded} />
      <EndLiveTalkWhen when={!launcher} />
      {askSheet && (
        <AskOptionsSheet
          exam={exam}
          onClose={() => setAskSheet(false)}
          onAtlas={openAtlas}
          onSocrates={() => {
            setAskSheet(false);
            router.push(routes.doubtSolver(exam.slug));
          }}
        />
      )}
    </LiveVoiceProvider>
  );
}

/** The floating Atlas button; hidden while a live talk runs (its mini bar sits there instead). */
function AtlasLiveLauncher({ show, onOpen }: { show: boolean; onOpen: () => void }) {
  const voice = useLiveVoice();
  return show && !voice?.isActive ? <ChatLauncher label="Ask Atlas" onOpen={onOpen} /> : null;
}

/** A dashboard live talk shouldn't carry on into pages with their own tutor (lectures) or none: hang up (and save). */
function EndLiveTalkWhen({ when }: { when: boolean }) {
  const voice = useLiveVoice();
  const active = !!voice?.isActive;
  const end = voice?.end;
  useEffect(() => {
    if (when && active) end?.();
  }, [when, active, end]);
  return null;
}

const OPTIONS = [
  { key: 'atlas', name: 'Atlas', tag: 'Quick', description: 'Ask anything. Get the full answer & explanation', youGet: 'Instant Answers', image: ATLAS_IMAGE },
  { key: 'socrates', name: 'Socrates', tag: 'Step by Step', description: 'Helps you solve problems one step at a time.', youGet: 'Stepwise Learning', image: SOCRATES_IMAGE },
] as const;

/** Mobile "Ask" sheet above the bottom bar: Atlas (quick answers) or Socrates (step by step). */
export function AskOptionsSheet({ onClose, onAtlas, onSocrates }: { exam: ExamConfig; onClose: () => void; onAtlas: () => void; onSocrates: () => void }) {
  const [video, setVideo] = useState(false);
  return (
    <>
      <div aria-hidden onClick={onClose} className="bg-brand/60 fixed inset-0 z-30 backdrop-blur-[2px] md:hidden" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Have a Question/Problem?"
        className="bg-surface shadow-socrates-sheet fixed right-3 bottom-[84px] left-3 z-30 mb-3 rounded-[22px] px-3.5 pt-[18px] pb-3.5 md:hidden"
      >
        <h2 className="text-socrates-ink text-center text-[17px] leading-6 font-semibold">Have a Question/Problem?</h2>
        <p className="text-socrates-muted mt-0.5 text-center text-[12px] leading-4">Two ways to solve, in any subject.</p>
        <div className="mt-[34px] grid grid-cols-2 gap-2.5">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={option.key === 'atlas' ? onAtlas : onSocrates}
              className="border-socrates-line flex flex-col rounded-[18px] border p-2 text-left transition-transform active:scale-[0.98]"
            >
              <div className="relative h-[96px] w-full" style={{ clipPath: 'inset(-80px 0 0 0 round 0 0 14px 14px)' }}>
                <div className="from-socrates-panel-from to-socrates-panel-to absolute inset-0 rounded-[14px] bg-linear-to-b" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={option.image} alt={option.name} className="absolute bottom-[-32px] left-1/2 h-[162px] w-auto max-w-none -translate-x-1/2 object-contain" />
              </div>
              <div className="flex flex-col px-1 pt-2.5 pb-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-socrates-text text-[15px] leading-5 font-bold">{option.name}</span>
                  <span className="bg-socrates-chip text-brand rounded-full px-1.5 py-px text-[9px] leading-[14px] font-semibold">{option.tag}</span>
                </div>
                <p className="text-socrates-muted mt-1.5 mb-1 min-h-[30px] text-[11px] leading-[15px]">{option.description}</p>
                <div className="border-socrates-line mt-2 border-t pt-1.5">
                  <p className="text-socrates-faint text-[9px] leading-3 font-semibold tracking-[0.4px] uppercase">You get</p>
                  <p className="text-brand mt-1 text-[13px] leading-[18px] font-semibold">{option.youGet}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {video ? (
          <p className="text-socrates-muted mt-3 text-center text-[12px]">Atlas gives you the full answer; Socrates guides you to it, one step at a time.</p>
        ) : (
          <button type="button" onClick={() => setVideo(true)} className="mt-3 flex w-full items-center justify-center gap-2">
            <span className="bg-brand text-on-brand flex size-5 items-center justify-center rounded-full">
              <Play aria-hidden className="size-2.5 fill-current" />
            </span>
            <span className="text-brand text-[13px] leading-[18px] font-semibold">Not sure? See how they differ</span>
          </button>
        )}
      </div>
    </>
  );
}
