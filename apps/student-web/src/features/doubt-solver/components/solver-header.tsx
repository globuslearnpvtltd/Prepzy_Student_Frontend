'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, History, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SOCRATES_IMAGE } from '@/features/assistant/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';

export interface SolverHeaderProps {
  onBack: () => void;
  /** Chat: the back chevron shows on desktop too (it asks before leaving). */
  showDesktopBack?: boolean;
  onQuestionBank?: () => void;
  onNewProblem?: () => void;
  onHistory?: () => void;
}

const pill = 'bg-socrates-chip text-brand hover:bg-socrates-chip-hover flex items-center gap-1.5 rounded-full text-[13px] font-medium md:text-[14px]';

/** Solver top bar: Prepzy › Socrates, Question Bank, New problem, previous doubts. */
export function SolverHeader({ onBack, showDesktopBack, onQuestionBank, onNewProblem, onHistory }: SolverHeaderProps) {
  const exam = useExam();
  return (
    <header className="border-neutral-100 bg-surface flex w-full shrink-0 items-center justify-between gap-2 border-b px-3 py-3 md:px-6 md:py-4">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className={cx('text-brand flex size-7 shrink-0 items-center justify-center hover:opacity-80', !showDesktopBack && 'md:hidden')}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <Link href={routes.dashboard(exam.slug)} aria-label="Go to dashboard" className="hidden shrink-0 md:flex">
          <Image src="/illustrations/assistant/prepzy-mark.png" alt="Prepzy" width={32} height={32} className="size-8 object-contain" />
        </Link>
        <ChevronRight aria-hidden className="text-socrates-faint hidden size-3.5 shrink-0 md:block" />
        <span className="flex min-w-0 items-center gap-1.5">
          <Image src={SOCRATES_IMAGE} alt="" width={30} height={30} className="bg-socrates-chip size-[30px] shrink-0 rounded-full object-cover object-top" />
          <span className="text-socrates-ink truncate font-serif text-[20px] leading-7 font-bold md:text-[24px]">Socrates</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onQuestionBank && (
          <button type="button" onClick={onQuestionBank} aria-label="Question Bank" className={cx(pill, 'h-8 px-2.5 md:h-[30px]')}>
            <Copy aria-hidden className="size-3.5" />
            <span className="max-[389px]:hidden">Question Bank</span>
          </button>
        )}
        {onNewProblem && (
          <button
            type="button"
            onClick={onNewProblem}
            aria-label="New problem"
            className="bg-brand text-on-brand hidden h-[30px] items-center gap-1.5 rounded-full px-3 text-[14px] font-medium md:flex"
          >
            <Plus aria-hidden className="size-3.5" /> New problem
          </button>
        )}
        {onHistory && (
          <button type="button" onClick={onHistory} aria-label="Previous doubts" title="Previous doubts" className={cx(pill, 'size-8 justify-center')}>
            <History aria-hidden className="size-4" />
          </button>
        )}
        {onNewProblem && (
          <button type="button" onClick={onNewProblem} aria-label="New problem" className={cx(pill, 'size-8 justify-center md:hidden')}>
            <Plus aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}

/** Desktop "← Back" under the header (start and ask steps). */
export function DesktopBack({ onClick }: { onClick: () => void }) {
  return (
    <div className="hidden shrink-0 px-6 pt-5 md:flex">
      <button type="button" onClick={onClick} className="text-brand flex items-center gap-2 text-[16px] leading-5 font-semibold hover:opacity-80">
        <ArrowLeft aria-hidden className="size-5" /> Back
      </button>
    </div>
  );
}
