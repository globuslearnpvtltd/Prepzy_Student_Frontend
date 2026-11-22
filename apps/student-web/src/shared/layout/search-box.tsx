'use client';

import { cx } from '@prepzy/design-system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, FileText, Library, Lock, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useActivePlan } from '@/features/auth';
import { RESTRICTED_COPY, showFeatureRestricted, useFeatureAccess } from '@/features/feature-access';
import { track } from '@/shared/analytics/track';
import type { ExamConfig } from '@/shared/config/exams';
import { ApiError } from '@/shared/lib/errors';
import { SearchResults, type SearchResultLink } from './search-results';
import { shellApi, shellKeys, type SearchSuggestion, type SuggestionKind } from './shell-api';

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Label and icon of each suggestion type. */
export const SUGGESTION_KINDS = {
  topic: { label: 'Topic', Icon: FileText },
  chapter: { label: 'Chapter', Icon: BookOpen },
  course: { label: 'Course', Icon: Library },
} satisfies Record<SuggestionKind, { label: string; Icon: typeof Search }>;

/** The backend's message for a rejected search (e.g. too many searches); a generic one for failures and outages. */
export const searchErrorText = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500
    ? error.message
    : "Search couldn't finish right now. Please try again.";

/**
 * The header's "Search chapters, notes and tests" box (the previous app's Searchbar):
 * - while typing, suggestions from GET /api/v4/search/:category/:examId/suggestions, each with its type. A suggestion
 *   with a link (competitive: course, notes topic, chapter) opens it; one without (board topics) runs the lecture
 *   search for its title and subject, as before.
 * - the arrow button runs the lecture search (POST .../lectures) and shows the results panel (see SearchResults).
 */
export function SearchBox(props: { exam: ExamConfig; onNavigate?: () => void; className?: string }) {
  const restricted = useFeatureAccess(props.exam).isRestricted('search');
  return restricted ? <LockedSearchBox className={props.className} /> : <OpenSearchBox {...props} />;
}

/** The search box when the student's institute switched search off: same look, disabled, with a padlock. */
function LockedSearchBox({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={`Search (${RESTRICTED_COPY.tooltip.toLowerCase()})`}
      title={RESTRICTED_COPY.tooltip}
      onClick={() => showFeatureRestricted('search')}
      className={cx(
        'border-line bg-surface flex h-11 w-full cursor-not-allowed items-center gap-2.5 rounded-full border pr-1 pl-4 text-left opacity-70',
        className,
      )}
    >
      <Search aria-hidden className="text-foreground-muted size-[18px] shrink-0" />
      <span className="text-foreground-muted min-w-0 flex-1 truncate text-[14px]">Search chapters, notes and tests</span>
      <span className="bg-canvas text-brand flex size-9 shrink-0 items-center justify-center rounded-full">
        <Lock aria-hidden className="size-4" />
      </span>
    </button>
  );
}

function OpenSearchBox({ exam, onNavigate, className }: { exam: ExamConfig; onNavigate?: () => void; className?: string }) {
  const router = useRouter();
  const plan = useActivePlan(exam);
  const classId = plan.data?.classId ?? null;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const subjectRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const panelId = useId();

  const lectures = useMutation({
    mutationFn: ({ query, subjectName }: { query: string; subjectName: string | null }) =>
      shellApi.searchLectures(exam, query, { subjectName, classId }),
    onSuccess: (result, { query }) =>
      track('search_performed', {
        exam_id: exam.examSlice,
        search_query: query,
        results_count: result ? 1 : 0,
        has_results: !!result,
      }),
  });
  const showingResults = !lectures.isIdle;

  const query = useDebounced(text.trim(), 500);
  const canSuggest = query.length > 0 && !showingResults && (exam.category === 'competitive' || classId !== null);
  const suggestions = useQuery({
    queryKey: shellKeys.search(exam.slug, query, classId),
    queryFn: () => shellApi.searchSuggestions(exam, query, classId),
    enabled: canSuggest,
    staleTime: 60_000,
  });
  const items = canSuggest ? (suggestions.data ?? []) : [];
  const listOpen = open && !showingResults && items.length > 0;
  const panelOpen = open && showingResults;

  useEffect(() => setActive(-1), [query]);

  // A click anywhere else closes the list and the results (as before).
  useEffect(() => {
    if (!listOpen && !panelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [listOpen, panelOpen]);

  const close = () => {
    setOpen(false);
    setActive(-1);
    lectures.reset();
  };

  const reset = () => {
    close();
    setText('');
  };

  const runSearch = (value: string, subjectName: string | null) => {
    if (!value.trim()) return;
    subjectRef.current = subjectName;
    setOpen(true);
    setActive(-1);
    lectures.mutate({ query: value.trim(), subjectName });
  };

  const pick = (item: SearchSuggestion) => {
    if (item.href) {
      reset();
      onNavigate?.();
      router.push(item.href);
      return;
    }
    setText(item.title);
    runSearch(item.title, item.subjectName);
  };

  const openResult = (link: SearchResultLink) => {
    track('search_result_clicked', {
      exam_id: exam.examSlice,
      result_type: link.type,
      subject: subjectRef.current,
      chapter_name: lectures.data?.moduleName ?? null,
      result_position: link.position,
    });
    reset();
    onNavigate?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (listOpen || panelOpen) event.preventDefault();
      close();
      return;
    }
    if (!listOpen) {
      if (event.key === 'ArrowDown' && items.length > 0) setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current >= items.length - 1 ? 0 : current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === 'Enter' && active >= 0 && active < items.length) {
      event.preventDefault();
      pick(items[active]!);
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div
      ref={containerRef}
      className={cx('relative', className)}
      onBlur={(event) => {
        // Keyboard focus moving out of the box closes it (pointer clicks outside are handled above).
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <form
        role="search"
        className="border-line bg-surface focus-within:border-brand flex h-11 items-center gap-2.5 rounded-full border pr-1 pl-4 transition-colors"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(text, null);
        }}
      >
        <Search aria-hidden className="text-foreground-muted size-[18px] shrink-0" />
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            lectures.reset();
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search chapters, notes and tests"
          role="combobox"
          aria-autocomplete="list"
          aria-label="Search topics"
          aria-controls={panelOpen ? panelId : listId}
          aria-expanded={listOpen || panelOpen}
          aria-activedescendant={listOpen && active >= 0 && active < items.length ? optionId(active) : undefined}
          className="text-foreground placeholder:text-foreground-muted h-full w-full min-w-0 bg-transparent text-[14px] outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          disabled={!text.trim()}
          className="bg-brand text-on-brand hover:bg-brand-800 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-90"
        >
          <ArrowRight aria-hidden className="size-[18px]" />
        </button>
      </form>
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="border-line bg-surface absolute top-full left-0 z-50 mt-2 w-full rounded-xl border px-4 py-2 shadow-lg"
        >
          {items.map((item, index) => {
            const { label, Icon } = SUGGESTION_KINDS[item.kind];
            return (
              <li
                key={item.key}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // Keeps focus in the box while the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
                className={cx(
                  'hover:bg-canvas flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[14px]',
                  index === active && 'bg-canvas',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon aria-hidden className="text-foreground-subtle size-4 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate capitalize">{item.title.toLowerCase()}</span>
                    <span className="text-foreground-subtle truncate text-[11px]">
                      {label}
                      {item.context && <span className="capitalize"> · {item.context}</span>}
                    </span>
                  </span>
                </span>
                {item.subject && (
                  <span className="bg-canvas text-foreground-subtle shrink-0 rounded-sm px-2 py-0.5 text-[10px] uppercase">
                    {item.subject}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {panelOpen && (
        <SearchResults
          exam={exam}
          id={panelId}
          status={lectures.isPending ? 'pending' : lectures.isError ? 'error' : 'success'}
          result={lectures.data ?? null}
          error={lectures.isError ? searchErrorText(lectures.error) : null}
          onRetry={() => lectures.variables && lectures.mutate(lectures.variables)}
          onDismiss={close}
          onOpen={openResult}
        />
      )}
    </div>
  );
}
