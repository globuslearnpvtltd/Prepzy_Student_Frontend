'use client';

import { cx } from '@prepzy/design-system';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { useExam } from '@/shared/hooks/use-exam';
import { formatSubject, type SolverBook } from '../api';
import { useBooks } from '../hooks';
import { useSolver } from '../store';

export const BOOK_PLACEHOLDER = '/illustrations/assistant/book-cover.jpg';

/** Carousel placement of a book `offset` places from the centre. */
export function bookTransform(offset: number, compact: boolean): string {
  const distance = Math.abs(offset);
  const step = compact ? (distance === 1 ? 95 : 168) : distance === 1 ? 155 : 275;
  const translate = offset === 0 ? 0 : Math.sign(offset) * step;
  const scale = offset === 0 ? 1 : distance === 1 ? 0.7 : 0.58;
  const rotate = offset === 0 ? 0 : Math.sign(offset) * (distance === 1 ? 4 : 8);
  return `translateX(calc(-50% + ${translate}px)) rotate(${rotate}deg) scale(${scale})`;
}

/** Shortest signed distance from the active book, wrapping around the list. */
export function wrapOffset(index: number, active: number, total: number): number {
  const o = (((index - active) % total) + total) % total;
  return o > total / 2 ? o - total : o;
}

function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

export function BookCover({ book, className }: { book: Pick<SolverBook, 'title' | 'image'>; className?: string }) {
  return (
    <span className={cx('relative block', className)}>
      <span aria-hidden className="bg-socrates-cover absolute top-[5px] right-[-7px] bottom-[-5px] left-1 rounded-l-[3px] rounded-r-[7px]" />
      <span aria-hidden className="bg-socrates-cover-soft absolute top-[3px] right-[-4px] bottom-[-3px] left-0.5 rounded-l-[3px] rounded-r-[6px]" />
      <span className="bg-surface relative block size-full overflow-hidden rounded-[6px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- textbook covers come from the backend's CDN */}
        <img
          src={book.image ?? BOOK_PLACEHOLDER}
          alt={book.title}
          onError={(event) => {
            event.currentTarget.src = BOOK_PLACEHOLDER;
          }}
          className="size-full object-cover"
        />
      </span>
    </span>
  );
}

/**
 * Step 1: pick a textbook. Tap the centre book to select it, then Next. "Question Bank" in the header
 * (`questionBankRequest` changes) opens the bank for the selected book, or asks to select one first.
 */
export function SubjectPicker({ onNext, onQuestionBank, questionBankRequest }: { onNext: () => void; onQuestionBank: () => void; questionBankRequest: number }) {
  const exam = useExam();
  const plan = useActivePlan(exam);
  const books = useBooks(exam);
  const { book: current, chooseBook } = useSolver();
  const list = books.data ?? [];
  const compact = useCompact();
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(false);
  const [needsPick, setNeedsPick] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const handled = useRef(questionBankRequest);
  const ready = !books.isPending;

  useEffect(() => {
    if (!list.length) return;
    const index = list.findIndex((b) => b.bookId === current?.bookId);
    setActive(index >= 0 ? index : 0);
    // Only when the list arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.data]);

  const activeBook = list[active];
  useEffect(() => {
    if (questionBankRequest === handled.current) return;
    handled.current = questionBankRequest;
    if (activeBook && selected) {
      chooseBook(activeBook);
      onQuestionBank();
    } else setNeedsPick(true);
  }, [questionBankRequest, activeBook, selected, chooseBook, onQuestionBank]);
  useEffect(() => {
    if (selected) setNeedsPick(false);
  }, [selected]);

  const move = (delta: number) => {
    setSelected(false);
    setActive((i) => (i + delta + list.length) % list.length);
  };
  const dotsStart = Math.min(Math.max(active - 2, 0), Math.max(list.length - 5, 0));

  return (
    <div className="border-socrates-line bg-surface shadow-socrates-card flex w-full max-w-[505px] flex-col items-center rounded-[20px] border-[1.4px] px-5 pt-5 pb-5 md:rounded-[25px] md:px-7 md:pt-8 md:pb-[30px]">
      <h2
        role={needsPick ? 'alert' : undefined}
        className={cx('font-serif text-[18px] leading-6 font-bold md:text-[22px] md:leading-7', needsPick ? 'text-socrates-error' : 'text-socrates-ink')}
      >
        {needsPick ? 'Please select a subject first' : 'Select your subject'}
      </h2>

      <div
        onTouchStart={(event) => {
          const t = event.touches[0];
          if (t) touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          const t = event.changedTouches[0];
          touch.current = null;
          if (!start || !t || list.length < 2) return;
          const dx = t.clientX - start.x;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(t.clientY - start.y)) return;
          move(dx < 0 ? 1 : -1);
        }}
        className="relative -mx-5 mt-3 h-[172px] self-stretch overflow-hidden md:-mx-7 md:mt-4 md:h-[262px]"
      >
        {!ready ? (
          <div aria-hidden className="absolute inset-0">
            {[-2, -1, 0, 1, 2].map((offset) => (
              <div
                key={offset}
                style={{ transform: bookTransform(offset, compact), zIndex: 10 - Math.abs(offset) }}
                className={cx(
                  'absolute top-3 left-1/2 h-[130px] w-[92px] animate-pulse rounded-[6px] md:top-3.5 md:h-[213px] md:w-[151px]',
                  Math.abs(offset) === 2 ? 'bg-socrates-soft' : 'bg-socrates-chip',
                )}
              />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-socrates-muted absolute inset-0 flex items-center justify-center text-center text-[12px]">
            {books.isError ? "Couldn't load your subjects." : 'No subjects available right now.'}
          </p>
        ) : (
          list.map((book, index) => {
            const offset = wrapOffset(index, active, list.length);
            if (Math.abs(offset) > 2) return null;
            const distance = Math.abs(offset);
            const dimmed = selected && offset !== 0;
            return (
              <button
                key={book.bookId}
                type="button"
                aria-label={`${formatSubject(book.subjectName)}, ${book.title}`}
                aria-pressed={offset === 0 ? selected : undefined}
                onClick={() => (offset === 0 ? setSelected((s) => !s) : (setSelected(false), setActive(index)))}
                style={{
                  transform: bookTransform(offset, compact),
                  zIndex: 10 - distance,
                  opacity: dimmed ? 0.45 : distance === 2 ? 0.75 : 1,
                  filter: dimmed ? 'blur(3px)' : 'none',
                }}
                className={cx(
                  'absolute top-3 left-1/2 h-[130px] w-[92px] origin-center rounded-[6px] transition-all duration-300 ease-out md:top-3.5 md:h-[213px] md:w-[151px]',
                  offset === 0 ? (selected ? 'shadow-socrates-pick' : 'shadow-socrates-book cursor-pointer') : 'shadow-sm',
                )}
              >
                <BookCover book={book} className="size-full" />
              </button>
            );
          })
        )}
        {ready && list.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous subject"
              className="bg-surface text-brand shadow-card absolute top-[120px] left-3.5 z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full md:flex"
            >
              <ChevronLeft aria-hidden className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next subject"
              className="bg-surface text-brand shadow-card absolute top-[120px] right-3.5 z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full md:flex"
            >
              <ChevronRight aria-hidden className="size-3.5" />
            </button>
          </>
        )}
      </div>

      <div aria-hidden className="mt-1 flex items-center gap-1.5">
        {(ready ? list.slice(dotsStart, dotsStart + 5) : [0, 1, 2, 3, 4]).map((item, i) => {
          const on = ready ? dotsStart + i === active : i === 2;
          return (
            <span
              key={i}
              className={cx('rounded-full transition-all', on ? 'bg-brand size-2' : 'bg-socrates-dot size-[5px]', !ready && 'bg-socrates-chip animate-pulse')}
            />
          );
        })}
      </div>

      <div className="mt-3 mb-[18px] flex min-h-[58px] flex-col items-center md:mt-4 md:mb-6 md:min-h-[71px]">
        {!ready ? (
          <>
            <span className="bg-socrates-chip h-5 w-24 animate-pulse rounded-full" />
            <span className="bg-socrates-soft mt-[7px] h-4 w-32 animate-pulse rounded-full" />
          </>
        ) : (
          activeBook && (
            <>
              <p className={cx('text-[16px] leading-5 font-semibold transition-colors md:text-[20px] md:leading-6', selected ? 'text-socrates-gold' : 'text-socrates-body')}>
                {formatSubject(activeBook.subjectName)}
              </p>
              <p className="text-socrates-muted mt-[3px] text-[13px] leading-[18px] md:mt-[5px] md:text-[16px] md:leading-5">{activeBook.title}</p>
              {activeBook.className && (
                <p className="text-socrates-muted mt-0.5 text-[12px] leading-4 md:text-[14px] md:leading-[19px]">
                  {formatSubject(activeBook.className)}
                  {plan.data?.streamName ? ` ${plan.data.streamName}` : ''}
                </p>
              )}
            </>
          )
        )}
      </div>

      <button
        type="button"
        disabled={!activeBook || !selected}
        onClick={() => {
          if (!activeBook) return;
          chooseBook(activeBook);
          onNext();
        }}
        className="from-brand-450 to-brand text-on-brand shadow-raised w-full rounded-full bg-linear-to-r py-[11px] text-[16px] leading-6 font-semibold disabled:opacity-40 md:rounded-[15px] md:py-[15px] md:text-[18px] md:leading-7"
      >
        Next
      </button>
    </div>
  );
}
