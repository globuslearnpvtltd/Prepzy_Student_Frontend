'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
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
 * "Start Searching here..." box with topic suggestions from the previous app's endpoints
 * (board: per class, competitive: NEET-wide).
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
        className="border-line bg-surface flex h-[52px] items-center gap-2 rounded-full border py-1 pr-2 pl-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) go();
        }}
      >
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Start Searching here..."
          role="combobox"
          aria-autocomplete="list"
          aria-label="Search topics"
          aria-controls={listId}
          aria-expanded={open && items.length > 0}
          className="text-foreground-muted h-full w-full bg-transparent text-[15px] font-medium outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="bg-brand hover:bg-brand-deep text-on-brand flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm"
        >
          <ArrowRight aria-hidden className="size-5" />
        </button>
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
