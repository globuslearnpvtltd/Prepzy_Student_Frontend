'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, X } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { learnApi } from '../api';
import { learnKeys } from '../hooks';
import { SectionError } from './kit';

const when = (iso: string | null) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return { day: '', time: '' };
  return {
    day: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
};

/** "Your attempts" on Chapter PYQs (previous app's PreviousExamSidebar): past chapter tests with review links. */
export function ChapterAttemptsDrawer({
  moduleId,
  subtitle,
  open,
  onOpenChange,
  canAttempt,
}: {
  moduleId: string;
  subtitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAttempt: boolean;
}) {
  const exam = useExam();
  const attempts = useQuery({
    queryKey: learnKeys.pyqAttempts(moduleId),
    queryFn: () => learnApi.chapterPyqAttempts(moduleId),
    enabled: open,
  });
  const list = attempts.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] w-full max-w-none transform-none gap-0 rounded-none rounded-t-[24px] p-0 md:top-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:rounded-l-[24px]">
        <div className="flex justify-center pt-2.5 md:hidden">
          <span className="bg-learn-handle h-1 w-9 rounded-full" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-3.5 pb-3.5 md:pt-[22px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle className="text-learn-ink text-[16px] leading-6 font-semibold md:text-[17px]">Your attempts</DialogTitle>
            <DialogDescription className="text-learn-muted truncate text-[11px] leading-4 font-medium">
              {subtitle || `${list.length} ${list.length === 1 ? 'attempt' : 'attempts'}`}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="text-learn-muted hover:bg-brand-50 hidden shrink-0 rounded-full p-1 md:flex"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {attempts.isError ? (
            <SectionError title="Failed to fetch attempts" error={attempts.error} />
          ) : attempts.isPending ? (
            [0, 1].map((i) => (
              <div key={i} aria-hidden className="border-learn-line flex flex-col gap-3 rounded-[14px] border p-3.5">
                <span className="bg-learn-track h-2.5 w-20 rounded-full" />
                <span className="grid grid-cols-2 gap-2">
                  <span className="bg-brand-25 h-[52px] rounded-[10px]" />
                  <span className="bg-brand-25 h-[52px] rounded-[10px]" />
                </span>
                <span className="bg-learn-soft h-8 rounded-full" />
              </div>
            ))
          ) : list.length === 0 ? (
            <div className="border-plan-line-strong bg-brand-25 flex flex-col items-center gap-1.5 rounded-[14px] border border-dashed px-5 py-7 text-center">
              <span className="bg-brand-75 mb-1.5 flex size-9 items-center justify-center rounded-full">
                <ClipboardCheck aria-hidden className="text-brand size-4" />
              </span>
              <span className="text-learn-ink text-sm font-semibold">No attempts yet</span>
              <span className="text-learn-muted max-w-[240px] text-[11px] leading-[17px]">
                Take this chapter&apos;s previous year questions as a test. Your score and answers will show up here.
              </span>
            </div>
          ) : (
            list.map((attempt, i) => {
              const date = when(attempt.date);
              return (
                <article key={attempt.attemptId} className="bg-surface border-learn-card flex flex-col gap-3 rounded-[14px] border p-3.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-learn-ink text-[13px] leading-[18px] font-semibold">Attempt {attempt.attemptNumber}</h3>
                    {i === 0 && <span className="bg-brand-75 text-brand rounded-full px-2 py-px text-[9px] leading-[14px] font-semibold">Latest</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-brand-25 flex flex-col gap-1 rounded-[10px] px-3 py-2.5">
                      <span className="text-learn-muted text-[9px] leading-3 font-semibold tracking-[0.3px] uppercase">Score</span>
                      <span className="text-brand text-[17px] leading-[22px] font-semibold">{attempt.score}</span>
                    </div>
                    <div className="bg-brand-25 flex flex-col justify-center gap-0.5 rounded-[10px] px-3 py-2.5">
                      <span className="text-[13px] leading-[18px] font-semibold text-neutral-650">{date.day}</span>
                      <span className="text-learn-muted text-xs font-medium">{date.time}</span>
                    </div>
                  </div>
                  <Link
                    href={routes.testResult(exam.slug, 'chapter-pyq', attempt.attemptId)}
                    className="bg-brand-75 text-brand hover:bg-brand-100 w-full rounded-full py-2 text-center text-xs leading-[18px] font-semibold"
                  >
                    Review attempt
                  </Link>
                </article>
              );
            })
          )}
        </div>
        {canAttempt && (
          <div className="px-4 pt-2 pb-4 md:pb-5">
            <Link
              href={routes.testPlayer(exam.slug, 'chapter-pyq', moduleId)}
              className="bg-brand text-on-brand block w-full rounded-full py-2.5 text-center text-xs leading-[18px] font-semibold"
            >
              {list.length > 0 ? 'Attempt again as a test' : 'Attempt as a test'}
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
