'use client';

import { cx } from '@prepzy/design-system';
import { ChevronLeft, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChatText } from '@/features/assistant/ui';
import { useExam } from '@/shared/hooks/use-exam';
import { buildSolvePayload, formatSubject, htmlToText, shortSubject, type BankQuestion, type BankTab, type SolvePayload } from '../api';
import { useBankQuestions, useChapters } from '../hooks';
import { useSolver } from '../store';
import { BookCover } from './subject-picker';

const PAGE_SIZE = 10;
const TABS: { key: BankTab; label: string }[] = [
  { key: 'end', label: 'End of chapter' },
  { key: 'pyq', label: "PYQ's" },
];

const titleCase = (value: string) => value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

/** Filters questions by text; maths is compared without LaTeX markup. */
export function matchesSearch(question: BankQuestion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const plain = (text: string) => htmlToText(text).replace(/\\[a-z]+|[${}\\]/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
  return [question.html, ...question.options, ...question.subQuestions].some((text) => plain(text).includes(q));
}

/** Chapter-wise end-of-chapter questions and PYQs for the chosen book; "Solve" hands one to Socrates. */
export function QuestionBank({ onBack, onChangeSubject, onSolve }: { onBack: () => void; onChangeSubject: () => void; onSolve: (payload: SolvePayload) => void }) {
  const exam = useExam();
  const { book, subject } = useSolver();
  const chapters = useChapters(book?.bookId ?? null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [tab, setTab] = useState<BankTab>('end');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const questions = useBankQuestions(exam, chapterId, tab);
  const chapter = chapters.data?.find((c) => c.id === chapterId) ?? null;
  const filtered = useMemo(() => (questions.data ?? []).filter((q) => matchesSearch(q, query)), [questions.data, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(0), [chapterId, tab, query]);

  const chapterList = (
    <ol className="flex flex-col gap-0.5" aria-label="Chapters">
      {chapters.data?.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            aria-current={c.id === chapterId ? 'true' : undefined}
            onClick={() => setChapterId(c.id)}
            className={cx('flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left', c.id === chapterId ? 'bg-socrates-chip' : 'hover:bg-socrates-soft')}
          >
            <span className="bg-socrates-chip text-socrates-body flex size-6 shrink-0 items-center justify-center rounded-full text-[12px]">{i + 1}</span>
            <span className="text-socrates-text text-[14px] leading-[18px] font-semibold">{titleCase(c.title)}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="bg-socrates-page flex h-dvh flex-col">
      <header className="bg-surface flex shrink-0 items-center gap-3 px-4 py-3 md:px-5">
        <button type="button" onClick={onBack} aria-label="Go back" className="text-brand flex items-center gap-1">
          <ChevronLeft aria-hidden className="size-6" />
          <span className="font-serif text-[22px] leading-7 font-bold">Question Bank</span>
        </button>
        {subject && <span className="bg-socrates-chip text-brand rounded-full px-2.5 py-0.5 text-[12px]">{shortSubject(subject.title)}</span>}
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="bg-surface border-socrates-divider hidden w-[320px] shrink-0 flex-col overflow-y-auto border-r p-[18px] md:flex">
          {book && (
            <button type="button" onClick={onChangeSubject} title="Change subject" className="border-socrates-line flex items-center gap-2.5 rounded-lg border-2 px-2.5 py-3 text-left">
              <BookCover book={book} className="h-10 w-[30px] shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="text-socrates-muted truncate text-[10px] font-semibold tracking-[0.4px] uppercase">
                  {book.title}
                  {book.className ? ` · ${book.className}` : ''}
                </span>
                <span className="text-socrates-text text-[15px] font-semibold">{subject ? shortSubject(subject.title) : ''}</span>
              </span>
            </button>
          )}
          <p className="text-socrates-faint mt-5 mb-2 px-1 text-[10px] font-semibold tracking-[0.5px] uppercase">Chapters</p>
          {chapters.isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="bg-socrates-soft h-9 animate-pulse rounded-md" />
              ))}
            </div>
          ) : chapters.data?.length ? (
            chapterList
          ) : (
            <p className="text-socrates-muted px-1 text-[13px]">No chapters found for this book.</p>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <p className="text-socrates-muted text-[10.5px] font-semibold tracking-[0.5px] uppercase">
            {book?.title ?? ''} · {chapters.data?.length ?? 0} chapters
          </p>
          <h1 className="text-socrates-ink mt-1 font-serif text-[22px] leading-8 font-semibold md:text-[24px]">{chapter ? titleCase(chapter.title) : 'Choose a chapter'}</h1>
          <label className="mt-3 block md:hidden">
            <span className="sr-only">Choose a chapter</span>
            <select
              aria-label="Choose a chapter"
              value={chapterId ?? ''}
              onChange={(event) => setChapterId(event.target.value ? Number(event.target.value) : null)}
              className="border-socrates-line bg-surface text-socrates-text w-full rounded-md border px-3 py-2.5 text-[14px]"
            >
              <option value="">Choose a chapter</option>
              {chapters.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {titleCase(c.title)}
                </option>
              ))}
            </select>
          </label>

          {!chapter ? (
            <div className="flex flex-col items-center px-6 py-16 text-center md:py-32">
              <h2 className="text-socrates-ink font-serif text-[20px] font-semibold">Select a chapter to see questions</h2>
              <p className="text-socrates-muted mt-2 max-w-[280px] text-[13px] leading-[19px]">
                Pick one from the list. Its end-of-chapter questions and PYQ&apos;s will show up here.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div role="tablist" aria-label="Question type" className="bg-socrates-chip flex rounded-full p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={cx('rounded-full px-4 py-1.5 text-[13px] font-semibold', tab === t.key ? 'bg-surface text-brand shadow-sm' : 'text-socrates-muted')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <label className="border-socrates-line bg-surface flex min-w-[200px] flex-1 items-center gap-2 rounded-full border px-3 py-1.5">
                  <Search aria-hidden className="text-socrates-faint size-4" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try a word or a formula"
                    aria-label="Search questions"
                    className="text-socrates-text min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-socrates-faint">
                      <X aria-hidden className="size-3.5" />
                    </button>
                  )}
                </label>
              </div>
              {questions.isPending ? (
                <div className="mt-4 flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="bg-surface h-24 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : questions.isError ? (
                <p className="text-socrates-muted py-10 text-center text-[13px]">Couldn&apos;t load the questions. Please try again.</p>
              ) : filtered.length === 0 ? (
                <p className="text-socrates-muted py-10 text-center text-[13px]">{query ? `No questions match “${query}”` : 'No questions here yet.'}</p>
              ) : (
                <ol className="mt-4 flex flex-col gap-3" aria-label="Questions">
                  {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((question, i) => (
                    <li key={question.id} className="border-socrates-line bg-surface flex flex-col gap-2.5 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-brand font-semibold">Q{page * PAGE_SIZE + i + 1}</span>
                        {question.level && <span className="bg-socrates-chip text-brand rounded-full px-2 py-0.5">{question.level}</span>}
                        {question.label && <span className="text-socrates-muted">{question.label}</span>}
                        {question.marks !== null && <span className="text-socrates-muted">{question.marks} marks</span>}
                      </div>
                      <ChatText text={question.html} className="text-socrates-text text-[14px] leading-[21px]" />
                      {question.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={question.image} alt="Question diagram" className="max-h-56 w-fit rounded-sm object-contain" />
                      )}
                      {question.options.length > 0 && (
                        <ol className="text-socrates-body grid gap-1 text-[13px] md:grid-cols-2">
                          {question.options.map((option, n) => (
                            <li key={n} className="flex gap-1.5">
                              <span>({String.fromCharCode(65 + n)})</span>
                              <ChatText text={option} />
                            </li>
                          ))}
                        </ol>
                      )}
                      <button
                        type="button"
                        onClick={() => onSolve(buildSolvePayload(question))}
                        className="from-brand-450 to-brand text-on-brand self-end rounded-full bg-linear-to-r px-5 py-1.5 text-[13px] font-semibold"
                      >
                        Solve
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3 text-[13px]">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="text-brand font-semibold disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-socrates-muted">
                    {page + 1} / {pages}
                  </span>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="text-brand font-semibold disabled:opacity-40">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          <span className="sr-only">{subject ? formatSubject(subject.title) : ''}</span>
        </main>
      </div>
    </div>
  );
}
