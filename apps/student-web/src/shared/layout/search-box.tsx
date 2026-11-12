'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { shellApi, shellKeys } from './shell-api';

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Where search results open until Learn / Notes are ported (board: Learn, competitive: Notes). */
export const searchTarget = (exam: ExamConfig) =>
  exam.category === 'competitive' ? routes.notes(exam.slug) : routes.learn(exam.slug);

/**
 * "Search chapters, notes and tests" box with suggestions from GET /api/v4/search/:category/:examId/suggestions
 * (board: topics of the student's class, competitive: the whole exam).
 */
export function SearchBox({ exam, onNavigate, className }: { exam: ExamConfig; onNavigate?: () => void; className?: string }) {
  const router = useRouter();
  const plan = useActivePlan(exam);
  const classId = plan.data?.classId ?? null;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const query = useDebounced(text.trim(), 500);
  const listId = useId();
  const canSearch = query.length > 0 && (exam.category === 'competitive' || classId !== null);
  const suggestions = useQuery({
    queryKey: shellKeys.search(exam.slug, query, classId),
    queryFn: () => shellApi.searchSuggestions(exam, query, classId),
    enabled: canSearch,
    staleTime: 60_000,
  });
  const items = canSearch ? (suggestions.data ?? []) : [];

  const go = (href?: string | null) => {
    setOpen(false);
    setText('');
    onNavigate?.();
    router.push(href ?? searchTarget(exam));
  };

  return (
    <div
      className={cx('relative', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        role="search"
        className="border-line bg-surface focus-within:border-brand flex h-11 items-center gap-2.5 rounded-full border px-4 transition-colors"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) go();
        }}
      >
        <Search aria-hidden className="text-foreground-muted size-[18px] shrink-0" />
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search chapters, notes and tests"
          role="combobox"
          aria-autocomplete="list"
          aria-label="Search topics"
          aria-controls={listId}
          aria-expanded={open && items.length > 0}
          className="text-foreground placeholder:text-foreground-muted h-full w-full min-w-0 bg-transparent text-[14px] outline-none"
        />
      </form>
      {open && items.length > 0 && (
        <ul
          id={listId}
          aria-label="Suggestions"
          className="border-line bg-surface absolute top-full left-0 z-50 mt-2 w-full rounded-xl border px-4 py-2 shadow-lg"
        >
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => go(item.href)}
                className="hover:bg-canvas flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[14px]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Search aria-hidden className="text-foreground-subtle size-4 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate capitalize">{item.title.toLowerCase()}</span>
                    {item.context && (
                      <span className="text-foreground-subtle truncate text-[11px] capitalize">{item.context}</span>
                    )}
                  </span>
                </span>
                <span className="bg-canvas text-foreground-subtle shrink-0 rounded-sm px-2 py-0.5 text-[10px] uppercase">
                  {item.subject}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
