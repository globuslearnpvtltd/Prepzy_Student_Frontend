'use client';

import { cx, Dialog, DialogContent, DialogDescription, DialogTitle, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSolveQuestion } from '@/features/doubt-solver';
import { RichText } from '@/features/exam-engine/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { formatTitle, learnApi, titleCase, type ChapterQuestion } from '../api';
import { learnKeys, useCourseOutline } from '../hooks';
import { ChapterAttemptsDrawer } from './attempts-drawer';
import { Breadcrumb, SectionError } from './kit';

const SOCRATES = '/illustrations/learn/socrates.png';
const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

export type FilterKey = 'all' | 'mcq' | 'very_short' | 'short' | 'long' | 'case_based' | 'writing';

/** Question-type filter chips; a chip only shows when a question of its kind exists. */
export const FILTERS: { key: FilterKey; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'mcq', label: 'MCQ', types: ['mcq', 'grammar_mcq'] },
  { key: 'very_short', label: 'Very short', types: ['very_short_answer'] },
  {
    key: 'short',
    label: 'Short',
    types: ['short_answer', 'short_answer_type-i', 'short_answer_type-ii', ' short _answer_type_ii', 'grammar_short'],
  },
  { key: 'long', label: 'Long', types: ['long_answer', 'long_answer_type-i', 'long_answer_type-ii'] },
  { key: 'case_based', label: 'Case based', types: ['case_based', 'unseen_passage'] },
  { key: 'writing', label: 'Writing', types: ['letter', 'paragraph'] },
];

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  grammar_mcq: 'Grammar MCQ',
  very_short_answer: 'Very short',
  short_answer: 'Short',
  long_answer: 'Long',
  'long_answer_type-i': 'Long Answer Type I',
  'long_answer_type-ii': 'Long Answer Type II',
  'short_answer_type-i': 'Short Answer Type I',
  'short_answer_type-ii': 'Short Answer Type II',
  ' short _answer_type_ii': 'Short Answer Type II',
  case_based: 'Case based',
  unseen_passage: 'Unseen passage',
};

export const questionTypeLabel = (type: string) =>
  TYPE_LABELS[type] ??
  type
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');

export function filterQuestions(questions: ChapterQuestion[], filter: FilterKey, year = 'all') {
  const types = FILTERS.find((f) => f.key === filter)?.types ?? [];
  return questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => (filter === 'all' || types.includes(question.type)) && (year === 'all' || question.year === year));
}

const html = 'text-learn-ink [&_p]:m-0';

/** One question with options / parts, and its solution behind "View solution". */
export function QuestionCard({
  question,
  index,
  showMarks = false,
  withSolution = false,
  subjectName,
}: {
  question: ChapterQuestion;
  index: number;
  showMarks?: boolean;
  withSolution?: boolean;
  /** Sent to Socrates with the question ("Solve step by step"). */
  subjectName?: string | null;
}) {
  const exam = useExam();
  const solve = useSolveQuestion(exam);
  const [open, setOpen] = useState(false);
  const isMcq = question.options.length > 0;
  const isCaseBased = question.type === 'case_based' || question.type === 'unseen_passage';
  const solution = isMcq ? question.explanation : question.sampleAnswer;
  const subAnswers = isCaseBased && question.subQuestions.some((sub) => sub.answerHtml || sub.answerImage);
  const hasSolution =
    withSolution && (question.options.some((o) => o.correct) || !!solution || !!question.answerImage || subAnswers);
  const showSolution = hasSolution && open;
  return (
    <article className="border-learn-line bg-surface flex w-full flex-col gap-2.5 rounded-lg border p-3.5 md:p-4">
      <header className="flex items-center justify-between gap-2">
        <span className={cx('text-brand text-[10px] leading-[14px] font-semibold', showMarks && 'tracking-[0.3px] uppercase')}>
          Q{index + 1} · {questionTypeLabel(question.type)}
          {showMarks && question.marks > 0 && ` · ${question.marks} ${question.marks === 1 ? 'mark' : 'marks'}`}
        </span>
        {question.year && <span className="text-learn-muted shrink-0 text-[10px] leading-[14px] font-semibold">CBSE {question.year}</span>}
        {question.difficulty && (
          <span className="text-learn-muted flex shrink-0 items-center gap-1.5 text-[10px] leading-[14px] font-medium">
            {titleCase(question.difficulty)}
            <span aria-hidden className="flex items-end gap-px">
              {[1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className={cx(
                    'w-1 rounded-[1px]',
                    bar === 1 ? 'h-[5px]' : bar === 2 ? 'h-2' : 'h-[11px]',
                    bar <= { easy: 1, medium: 2, hard: 3 }[question.difficulty!] ? 'bg-brand' : 'bg-brand-200',
                  )}
                />
              ))}
            </span>
          </span>
        )}
      </header>

      <RichText html={question.html} className={cx('text-[13.5px] leading-5', html)} />
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image} alt="Question illustration" className="border-learn-line max-h-64 max-w-md rounded-[10px] border object-contain" />
      )}

      {isMcq && (
        <ol className="mt-0.5 flex flex-col gap-1.5">
          {question.options.map((option, i) => {
            const correct = showSolution && option.correct;
            return (
              <li
                key={option.id}
                className={cx('flex items-start gap-2.5 rounded-sm border px-2 py-1', correct ? 'bg-learn-ok-soft border-learn-ok-line' : 'border-learn-line-strong')}
              >
                <span className={cx('shrink-0 text-[13px] leading-5 font-medium', correct ? 'text-learn-ok' : 'text-learn-muted')}>
                  ({OPTION_LETTERS[i] ?? i + 1})
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <RichText html={option.html} className={cx('text-[13.5px] leading-5', correct ? 'text-learn-ok font-medium [&_p]:m-0' : html)} />
                  {option.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.image} alt="Option illustration" className="max-w-[200px] rounded-sm object-contain" />
                  )}
                </span>
                {correct && <Check aria-label="Correct answer" className="text-learn-ok mt-0.5 size-4 shrink-0" />}
              </li>
            );
          })}
        </ol>
      )}

      {isCaseBased && question.subQuestions.length > 0 && (
        <ol className="mt-0.5 flex flex-col gap-2">
          {question.subQuestions.map((sub, i) => (
            <li key={sub.id} className="flex flex-col gap-1.5">
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-2">
                  <span className="text-learn-muted shrink-0 text-[12px] leading-5 font-medium">({i + 1})</span>
                  <RichText html={sub.html} className={cx('text-[12px] leading-5', html)} />
                </span>
                {sub.marks > 0 && (
                  <span className="text-learn-muted shrink-0 text-[10px] leading-5 font-medium">
                    [{sub.marks} {sub.marks === 1 ? 'mark' : 'marks'}]
                  </span>
                )}
              </span>
              {sub.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sub.image} alt="Sub-question illustration" className="border-learn-line max-w-sm rounded-sm border object-contain" />
              )}
            </li>
          ))}
        </ol>
      )}

      {showSolution && (!!solution || !!question.answerImage || subAnswers) && (
        <div className="bg-learn-hover flex flex-col gap-1.5 rounded-[10px] px-3.5 py-3">
          <span className="text-learn-muted text-[10px] leading-[14px] font-semibold tracking-[0.6px] uppercase">
            {isMcq ? 'Explanation' : 'Solution'}
          </span>
          {solution && <RichText html={solution} className={cx('text-[13px] leading-5', html)} />}
          {subAnswers &&
            question.subQuestions.map((sub, i) =>
              sub.answerHtml || sub.answerImage ? (
                <div key={sub.id} className="flex items-start gap-2">
                  <span className="text-learn-muted shrink-0 text-[12px] leading-5 font-medium">({i + 1})</span>
                  <span className="flex flex-col gap-1.5">
                    {sub.answerHtml && <RichText html={sub.answerHtml} className={cx('text-[13px] leading-5', html)} />}
                    {sub.answerImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sub.answerImage} alt="Answer illustration" className="max-w-sm rounded-sm object-contain" />
                    )}
                  </span>
                </div>
              ) : null,
            )}
          {question.answerImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.answerImage} alt="Solution illustration" className="max-w-md rounded-sm object-contain" />
          )}
        </div>
      )}

      <footer className={cx('mt-1 flex items-center gap-2', hasSolution ? 'justify-between' : 'justify-end')}>
        {hasSolution && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="bg-brand-75 hover:bg-brand-100 text-brand flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] leading-[18px] font-semibold"
          >
            {open ? 'Hide solution' : 'View solution'}
            {open ? <ChevronUp aria-hidden className="size-3.5" /> : <ChevronDown aria-hidden className="size-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            solve(
              {
                html: question.html,
                options: question.options.map((o) => o.html),
                subQuestions: question.subQuestions.map((sq) => sq.html),
                image: question.image,
                imageDescription: question.imageDescription,
              },
              subjectName,
            )
          }
          className="bg-brand-75 hover:bg-brand-100 text-brand flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[12px] leading-[18px] font-semibold"
        >
          <Image src={SOCRATES} alt="" width={22} height={22} className="bg-surface size-[22px] rounded-full object-cover" />
          Solve step by step
        </button>
      </footer>
    </article>
  );
}

export function QuestionSkeletons() {
  return (
    <div aria-busy="true" aria-label="Loading questions" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[104px] w-full rounded-md" />
      ))}
    </div>
  );
}

/** Two balanced columns on desktop (as the previous app laid out cards), one on mobile. */
function QuestionGrid({ items, render }: { items: { question: ChapterQuestion; index: number }[]; render: (item: { question: ChapterQuestion; index: number }) => React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">{items.map(render)}</div>
      <div className="hidden items-start gap-4 md:flex">
        <div className="flex min-w-0 flex-1 flex-col gap-4">{items.filter((_, i) => i % 2 === 0).map(render)}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{items.filter((_, i) => i % 2 === 1).map(render)}</div>
      </div>
    </>
  );
}

function FilterChips({ filters, value, onChange }: { filters: typeof FILTERS; value: FilterKey; onChange: (key: FilterKey) => void }) {
  return (
    <div role="group" aria-label="Question type" className="bg-learn-chip inline-flex items-center gap-0.5 rounded-full p-1">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={value === f.key}
          onClick={() => onChange(f.key)}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-[12px] leading-[18px] whitespace-nowrap transition-colors',
            value === f.key ? 'bg-surface text-learn-ink font-semibold shadow-sm' : 'text-learn-muted hover:text-learn-ink font-medium',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Learn › Subject › Ch n: Title › current page, back to the chapter's Practice tab. */
function ChapterCrumbs({ courseId, moduleId, current }: { courseId: string; moduleId: string; current: string }) {
  const exam = useExam();
  const outline = useCourseOutline(courseId);
  const chapters = outline.data?.chapters ?? [];
  const index = chapters.findIndex((c) => c.id === moduleId);
  const chapterHref = routes.boardModule(exam.slug, courseId, moduleId, 'practice');
  return (
    <Breadcrumb
      backHref={chapterHref}
      crumbs={[
        { label: 'Learn', href: routes.learn(exam.slug) },
        ...(outline.data?.course ? [{ label: titleCase(outline.data.course.subjectName) }] : []),
        ...(index >= 0 ? [{ label: `Ch ${index + 1}: ${formatTitle(chapters[index]!.title)}`, href: chapterHref }] : []),
        { label: current },
      ]}
    />
  );
}

const SOCRATES_BANNER_KEY = 'prepzy-socrates-banner-seen';

/** Socrates banner, once per login (same flag as the previous app). */
function useOncePerLogin(key: string) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) {
        setShow(true);
        localStorage.setItem(key, '1');
      }
    } catch {
      setShow(true);
    }
  }, [key]);
  return [show, setShow] as const;
}

/** Chapter PYQs: type + year filters, attempt as a test, solve with Socrates. */
const HOW_IT_WORKS_VIDEO = '/media/socrates-how-it-works.mp4';

export function ChapterPyqsScreen({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const exam = useExam();
  const subjectName = useCourseOutline(courseId).data?.course?.subjectName ?? null;
  const query = useQuery({ queryKey: learnKeys.pyqs(moduleId), queryFn: () => learnApi.chapterPyqs(moduleId) });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [year, setYear] = useState('all');
  const [banner, setBanner] = useOncePerLogin(SOCRATES_BANNER_KEY);
  const questions = useMemo(() => query.data ?? [], [query.data]);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const outline = useCourseOutline(courseId).data;
  const chapterTitle = outline?.chapters.find((c) => c.id === moduleId)?.title ?? '';

  const years = useMemo(
    () => Array.from(new Set(questions.map((q) => q.year).filter((y): y is string => !!y))).sort((a, b) => Number(b) - Number(a)),
    [questions],
  );
  const range = useMemo(() => {
    const numbers = years.map(Number).filter((n) => !Number.isNaN(n));
    if (!numbers.length) return '';
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return min === max ? `CBSE ${min}` : `CBSE ${min} to ${max}`;
  }, [years]);

  if (query.isError) return <SectionError title="Failed To Fetch PYQs" error={query.error} />;
  const filters = FILTERS.filter((f) => f.key === 'all' || questions.some((q) => f.types.includes(q.type)));
  const visible = filterQuestions(questions, filter, year);
  const testHref = routes.testPlayer(exam.slug, 'chapter-pyq', moduleId);
  const yearSelect = (
    <label className="shrink-0">
      <span className="sr-only">Filter by year</span>
      <select
        value={year}
        onChange={(event) => setYear(event.target.value)}
        className="border-learn-line-strong bg-surface text-learn-ink rounded-full border py-[7px] pr-3 pl-3.5 text-[12px] leading-[18px] font-semibold"
      >
        <option value="all">All years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex w-full flex-col gap-4 px-1 pt-4 pb-6 md:px-[22px] md:pb-[33px]">
      <ChapterCrumbs courseId={courseId} moduleId={moduleId} current="Chapter PYQs" />
      <ChapterAttemptsDrawer
        moduleId={moduleId}
        open={attemptsOpen}
        onOpenChange={setAttemptsOpen}
        canAttempt={questions.length > 0}
        subtitle={[chapterTitle && formatTitle(chapterTitle), questions.length ? `${questions.length} questions` : ''].filter(Boolean).join(' · ')}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-learn-ink text-[20px] leading-7 font-semibold md:text-[22px] md:leading-[30px]">Chapter PYQs</h1>
          <p className="text-learn-muted truncate text-[13px] leading-5 font-medium">
            Previous year board questions{range && ` · ${range}`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAttemptsOpen(true)}
            className="border-learn-line-strong bg-surface text-brand flex-1 rounded-full border px-4 py-2 text-center text-[12px] leading-[18px] font-semibold md:flex-none"
          >
            Your attempts
          </button>
          {questions.length > 0 ? (
            <Link
              href={testHref}
              className="bg-brand hover:bg-brand-deep text-on-brand flex-1 rounded-full px-4 py-2 text-center text-[12px] leading-[18px] font-semibold md:flex-none"
            >
              Attempt as a test
            </Link>
          ) : (
            <span className="bg-brand text-on-brand flex-1 rounded-full px-4 py-2 text-center text-[12px] leading-[18px] font-semibold opacity-60 md:flex-none">
              Attempt as a test
            </span>
          )}
        </div>
      </div>

      {banner && (
        <aside aria-label="Socrates" className="bg-learn-track flex w-full flex-col gap-3.5 rounded-lg px-3.5 py-3.5 md:flex-row md:items-center md:gap-4 md:px-[18px] md:py-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center md:gap-4">
            <Image src={SOCRATES} alt="" width={62} height={62} className="h-auto w-[52px] shrink-0 object-contain md:w-[62px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-ink text-[12px] leading-[19px] font-semibold md:text-[14px] md:leading-5">
                Stuck on a question? Solve it step by step with Socrates.
              </p>
              <p className="text-foreground-muted text-[11px] leading-[18px] md:text-[12px]">
                You ask him about the concepts to be applied or you tell him where you&apos;re stuck. He answers and helps you reach
                the answer/solution one step at a time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="bg-surface flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-[12px] leading-4 font-semibold md:w-auto md:py-2 md:text-[11px]"
          >
            <Play aria-hidden className="text-brand size-3" />
            <span className="text-brand">See how it works · 30 sec</span>
          </button>
          <button type="button" onClick={() => setBanner(false)} aria-label="Close" className="text-learn-muted shrink-0 self-start p-1 md:self-center">
            <X aria-hidden className="size-4" />
          </button>
        </aside>
      )}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="bg-neutral-950 max-w-[860px] gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">How Socrates works</DialogTitle>
          <DialogDescription className="sr-only">A 30 second demo of solving a question step by step.</DialogDescription>
          <video src={HOW_IT_WORKS_VIDEO} controls autoPlay playsInline className="aspect-video w-full" />
        </DialogContent>
      </Dialog>

      {(filters.length > 1 || years.length > 1) && (
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto">{filters.length > 1 && <FilterChips filters={filters} value={filter} onChange={setFilter} />}</div>
          {years.length > 1 && <div className="hidden md:block">{yearSelect}</div>}
        </div>
      )}
      {!query.isPending && questions.length > 0 && (
        <div className="flex w-full items-center justify-between gap-3 md:hidden">
          <span className="text-learn-muted text-[12px] leading-[18px] font-medium">
            {visible.length} {visible.length === 1 ? 'question' : 'questions'}
          </span>
          {years.length > 1 && yearSelect}
        </div>
      )}

      {query.isPending ? (
        <QuestionSkeletons />
      ) : visible.length === 0 ? (
        <p className="text-learn-muted w-full py-10 text-center text-[14px] font-medium">
          {questions.length ? 'No questions match these filters.' : 'No PYQs available yet.'}
        </p>
      ) : (
        <QuestionGrid items={visible} render={({ question, index }) => <QuestionCard key={question.id} question={question} index={index} subjectName={subjectName} />} />
      )}
    </div>
  );
}

/** NCERT end-of-chapter questions with solutions. */
export function NcertQuestionsScreen({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const subjectName = useCourseOutline(courseId).data?.course?.subjectName ?? null;
  const query = useQuery({ queryKey: learnKeys.ncert(moduleId), queryFn: () => learnApi.ncertQuestions(moduleId) });
  const [filter, setFilter] = useState<FilterKey>('all');
  if (query.isError) return <SectionError title="Failed To Fetch NCERT Chapter Questions" error={query.error} />;
  const questions = query.data ?? [];
  const filters = FILTERS.filter((f) => f.key === 'all' || questions.some((q) => f.types.includes(q.type)));
  const visible = filterQuestions(questions, filter);
  return (
    <div className="flex w-full flex-col gap-4 px-1 pt-4 pb-6 md:px-[22px] md:pb-[33px]">
      <ChapterCrumbs courseId={courseId} moduleId={moduleId} current="NCERT chapter questions" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-learn-ink text-[20px] leading-7 font-semibold md:text-[22px] md:leading-[30px]">NCERT Chapter Questions</h1>
        <p className="text-learn-muted truncate text-[13px] leading-5 font-medium">End of chapter questions from the NCERT textbook</p>
      </div>
      {filters.length > 1 && (
        <div className="w-full overflow-x-auto">
          <FilterChips filters={filters} value={filter} onChange={setFilter} />
        </div>
      )}
      {query.isPending ? (
        <QuestionSkeletons />
      ) : visible.length === 0 ? (
        <p className="text-learn-muted w-full py-10 text-center text-[14px] font-medium">No NCERT questions available yet.</p>
      ) : (
        <QuestionGrid
          items={visible}
          render={({ question, index }) => <QuestionCard key={question.id} question={question} index={index} showMarks withSolution subjectName={subjectName} />}
        />
      )}
    </div>
  );
}
