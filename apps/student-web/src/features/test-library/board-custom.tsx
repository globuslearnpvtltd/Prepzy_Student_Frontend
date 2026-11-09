'use client';

import { Alert, AlertTitle, cx, Dialog, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Loader2, Search, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTestContext } from '@/features/exam-engine';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import {
  boardCustomApi,
  MAX_CUSTOM_TOPICS,
  type BoardCustomChapter,
  type BoardCustomCourse,
  type BoardCustomSet,
  type BoardDifficulty,
} from './board-custom-api';
import { GridSkeleton, LoadError } from './kit';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STEPS = ['Course', 'Chapters', 'Topics', 'Configure'] as const;
const DIFFICULTIES: { value: BoardDifficulty; text: string }[] = [
  { value: 'easy', text: 'Basic Concepts' },
  { value: 'medium', text: 'Standard Level' },
  { value: 'hard', text: 'Advanced' },
];

/** Full-screen sheet shared by the builder and the saved list (previous app's dashboard modals). */
function Sheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-dvh max-h-none w-full max-w-none gap-0 overflow-hidden rounded-none p-0 md:h-[90%] md:w-[calc((100%-32px)*0.98)] md:rounded-[20px]">
        <div className="flex items-center justify-between border-b-2 border-neutral-100 px-6 py-5 md:px-10 md:py-[26px]">
          <button type="button" onClick={() => onOpenChange(false)} className="hidden items-center gap-2 text-[16px] font-bold text-neutral-600 md:flex">
            <ArrowLeft aria-hidden className="size-4" /> Back to Dashboard
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-full border border-neutral-600 md:hidden"
          >
            <ChevronLeft aria-hidden className="size-4 text-neutral-600" />
          </button>
          <p className="ml-3 flex-1 text-2xl font-bold text-neutral-950 md:hidden">{title}</p>
          <div className="hidden items-center gap-6 md:flex">
            {header}
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
              <X aria-hidden className="size-6 text-neutral-600" />
            </button>
          </div>
        </div>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- builder -------------------------------- */

/** "Customize Test" on the board Assessments page: course → one chapter → up to 5 topics → difficulty. */
export function BoardCustomTestBuilder({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const exam = useExam();
  const router = useRouter();
  const { context } = useTestContext();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [course, setCourse] = useState<BoardCustomCourse | null>(null);
  const [chapter, setChapter] = useState<BoardCustomChapter | null>(null);
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<BoardDifficulty>('easy');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const courses = useQuery({
    queryKey: ['test-library', exam.slug, 'board-custom-courses', context?.classId, debounced],
    queryFn: () => boardCustomApi.courses(context!.classId, debounced),
    enabled: open && !!context,
  });
  const chapters = useQuery({
    queryKey: ['test-library', exam.slug, 'board-custom-chapters', course?.id],
    queryFn: () => boardCustomApi.chapters(course!.id),
    enabled: open && !!course,
  });
  const generate = useMutation({
    mutationFn: () => boardCustomApi.generate({ courseId: course!.id, chapter: chapter!, topicIds, difficulty }),
    onSuccess: (setId) => {
      if (setId) router.push(routes.testPlayer(exam.slug, 'custom', setId));
    },
  });

  const pickCourse = (c: BoardCustomCourse) => {
    setCourse((prev) => (prev?.id === c.id ? null : c));
    setChapter(null);
    setTopicIds([]);
  };
  const pickChapter = (c: BoardCustomChapter) => {
    setChapter((prev) => (prev?.id === c.id ? null : c));
    setTopicIds([]);
  };
  const toggleTopic = (id: number) =>
    setTopicIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : prev.length >= MAX_CUSTOM_TOPICS ? prev : [...prev, id]));

  const canNext = [!!course, !!chapter, topicIds.length > 0, true][step];
  const next = () => {
    if (!canNext) return;
    if (step === STEPS.length - 1) generate.mutate();
    else setStep(step + 1);
  };
  const noQuestions = generate.isSuccess && generate.data === null;
  const selectedTopics = chapter?.topics.filter((t) => topicIds.includes(t.id)) ?? [];
  const tile = (selected: boolean) =>
    cx('cursor-pointer rounded-[20px] border-2 p-6 text-left', selected ? 'border-brand bg-neutral-50' : 'border-brand-150 bg-neutral-50');

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Custom Exam"
      description="Build a personalised test from a chapter's topics"
      header={
        <ol className="flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={i === step ? 'step' : undefined}
                className={cx(
                  'flex size-8 items-center justify-center rounded-full text-sm font-bold',
                  i === step ? 'bg-brand text-on-brand' : 'bg-neutral-200 text-neutral-550',
                )}
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && <span className="h-1 w-12 bg-neutral-200" />}
            </li>
          ))}
        </ol>
      }
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 w-full flex-col md:w-3/4">
          <div className="px-6 pt-6 md:border-b-2 md:border-neutral-100 md:px-10">
            <DialogTitle className="sr-only text-[36px] leading-[43px] font-bold text-neutral-950 md:not-sr-only md:block">Create Custom Test</DialogTitle>
            <p className="hidden pt-1 text-sm text-neutral-600 md:block">Build your personalized assessment</p>
            <div className="flex overflow-x-auto pt-4 md:gap-2">
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className={cx(
                    'shrink-0 px-3.5 py-4 text-xs leading-3 font-semibold md:rounded-t-[20px] md:px-6 md:py-3 md:text-[16px] md:leading-5',
                    i === 0 && 'rounded-l-[20px] md:rounded-bl-none',
                    i === STEPS.length - 1 && 'rounded-r-[20px] md:rounded-br-none',
                    i === step ? 'bg-brand text-on-brand' : 'bg-neutral-200 text-neutral-550',
                  )}
                >
                  <span className="hidden md:inline">{i + 1}. </span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
            {step === 0 && (
              <div className="flex flex-col gap-8">
                <label className="relative block">
                  <span className="sr-only">Search courses</span>
                  <Search aria-hidden className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-350" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search courses..."
                    className="h-[52px] w-full rounded-[20px] border-2 border-neutral-200 pr-4 pl-12 text-[16px]"
                  />
                </label>
                {courses.isPending ? (
                  <GridSkeleton />
                ) : courses.isError ? (
                  <LoadError error={courses.error} />
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {courses.data.map((c) => {
                      const selected = course?.id === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => pickCourse(c)}
                            className={cx(
                              'flex w-full items-center justify-between rounded-[20px] border-2 p-6 text-left',
                              selected ? 'border-brand bg-brand text-on-brand' : 'border-brand-150 bg-neutral-50',
                            )}
                          >
                            <span className="flex flex-col gap-3">
                              <span className={cx('text-[16px] leading-4 font-bold', selected ? 'text-on-brand' : 'text-neutral-950')}>{c.name}</span>
                              <span className={cx('text-xs leading-3 font-semibold', selected ? 'text-on-brand' : 'text-neutral-550')}>{c.subject}</span>
                            </span>
                            {selected && <CircleCheck aria-hidden className="size-5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">
                    Select any one chapter • <span className="text-brand font-bold">{chapter ? 1 : 0} Selected</span>
                  </p>
                  <button type="button" onClick={() => setChapter(null)} className="text-danger-600 text-xs font-semibold">
                    Clear All
                  </button>
                </div>
                {chapters.isPending ? (
                  <GridSkeleton />
                ) : chapters.isError ? (
                  <LoadError error={chapters.error} />
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {chapters.data.map((c) => {
                      const selected = chapter?.id === c.id;
                      return (
                        <li key={c.id}>
                          <button type="button" aria-pressed={selected} onClick={() => pickChapter(c)} className={cx(tile(selected), 'flex w-full items-center gap-3')}>
                            <span
                              className={cx(
                                'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                                selected ? 'border-brand bg-surface' : 'border-neutral-300',
                              )}
                            >
                              {selected && <Check aria-hidden className="text-brand size-3.5" />}
                            </span>
                            <span className="flex flex-col gap-3">
                              <span className={cx('text-[16px] leading-[18px] font-bold', selected ? 'text-brand' : 'text-neutral-950')}>{titleCase(c.name)}</span>
                              <span className="text-xs leading-3 font-semibold text-neutral-550">{c.topics.length} topics</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {step === 2 && chapter && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-neutral-600">
                  Select specific topics from each chapter (up to {MAX_CUSTOM_TOPICS})
                </p>
                <div className="border-brand/40 flex flex-col gap-3 rounded-[20px] border-2 bg-neutral-50 p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-neutral-800">{titleCase(chapter.name)}</p>
                    <button type="button" onClick={() => setTopicIds([])} className="text-brand text-xs font-semibold">
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {chapter.topics.map((t) => {
                      const selected = topicIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleTopic(t.id)}
                          className={cx(
                            'rounded-[20px] border-2 px-3.5 py-2.5 text-xs font-semibold',
                            selected ? 'bg-brand border-brand-800 text-on-brand' : 'bg-surface border-neutral-200 text-neutral-700',
                          )}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <fieldset className="border-brand-150 flex flex-col gap-4 rounded-[20px] border-2 bg-neutral-50 p-6">
                  <legend className="sr-only">Difficulty Level</legend>
                  <p aria-hidden className="text-[20px] font-bold text-neutral-950">
                    Difficulty Level
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={difficulty === d.value}
                        onClick={() => setDifficulty(d.value)}
                        className={cx(
                          'bg-surface flex flex-1 flex-col gap-2.5 rounded-2xl border-2 p-[22px] text-center',
                          difficulty === d.value ? 'border-brand' : 'border-brand-150',
                        )}
                      >
                        <span className={cx('text-sm font-bold', difficulty === d.value ? 'text-brand' : 'text-neutral-950')}>{titleCase(d.value)}</span>
                        <span className="text-xs text-neutral-600">{d.text}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {noQuestions && (
                  <Alert tone="danger">
                    <AlertTitle>Questions Not Available</AlertTitle>
                    Questions are not available for these topics. Select other topics.
                  </Alert>
                )}
                {generate.isError && <Alert tone="danger">{userMessage(generate.error)}</Alert>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-2 border-neutral-100 bg-neutral-50 px-6 py-[18px] md:px-10">
            <button
              type="button"
              onClick={() => setStep(Math.max(step - 1, 0))}
              disabled={step === 0}
              aria-label="Go Back"
              className={cx(
                'flex items-center gap-2 rounded-full border-2 p-3 text-[16px] font-semibold md:rounded-[14px] md:px-[30px] md:py-4',
                step === 0 ? 'cursor-not-allowed border-neutral-300 bg-neutral-100 text-neutral-350' : 'border-brand text-brand bg-neutral-50',
              )}
            >
              <ChevronLeft aria-hidden className="size-4" />
              <span className="hidden md:inline">Go Back</span>
            </button>
            <button
              type="button"
              onClick={next}
              disabled={generate.isPending}
              className="border-brand bg-brand text-on-brand flex items-center gap-2 rounded-full border-2 px-11 py-4 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 md:rounded-[14px] md:px-[30px]"
            >
              {generate.isPending ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" /> Generating…
                </>
              ) : step === STEPS.length - 1 ? (
                'Generate Test'
              ) : (
                <>
                  Next <ChevronRight aria-hidden className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <aside aria-label="Selection Summary" className="bg-brand-75 hidden w-1/4 flex-col gap-6 overflow-y-auto p-[26px] md:flex">
          <p className="text-2xl font-semibold text-neutral-950">Selection Summary</p>
          <div className="flex gap-3">
            {(
              [
                [chapter && topicIds.length ? 1 : 0, 'Chapters'],
                [topicIds.length, 'Topics'],
              ] as const
            ).map(([value, label]) => (
              <div key={label} className="border-brand-150 bg-surface flex flex-1 flex-col gap-1 rounded-[20px] border-2 p-4 text-center">
                <span className="text-brand text-2xl leading-8 font-bold">{value}</span>
                <span className="text-xs text-neutral-600">{label}</span>
              </div>
            ))}
          </div>
          {course && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-neutral-500">COURSE</p>
              <div className="border-brand-150 bg-surface rounded-[20px] border-2 p-6">
                <p className="text-[16px] font-bold text-neutral-950">{titleCase(course.name)}</p>
                <p className="text-xs text-neutral-550">{titleCase(course.subject)}</p>
              </div>
            </div>
          )}
          {chapter && selectedTopics.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-neutral-500">SELECTED TOPICS</p>
              <div className="border-brand-150 bg-surface flex flex-col gap-3 rounded-[20px] border-2 p-6">
                <p className="text-xs font-bold text-neutral-700">{titleCase(chapter.name)}</p>
                {selectedTopics.map((t) => (
                  <p key={t.id} className="flex items-center gap-2 text-xs text-neutral-600">
                    <CircleCheck aria-hidden className="text-brand size-3" />
                    {titleCase(t.name)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Sheet>
  );
}

/* ------------------------------- saved tests ------------------------------ */

/** "Saved Tests" on the board Assessments page: every custom set with attempts and a score card per attempt. */
export function BoardSavedTests({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
}) {
  const exam = useExam();
  const { context } = useTestContext();
  const [active, setActive] = useState<BoardCustomSet | null>(null);
  const sets = useQuery({
    queryKey: ['test-library', exam.slug, 'board-custom-sets', context?.classId],
    queryFn: () => boardCustomApi.savedSets(context!.classId),
    enabled: open && !!context,
  });
  const button = 'flex w-full items-center justify-center rounded-[14px] border-[1.5px] border-brand px-6 py-3.5 text-xs leading-3 font-semibold';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="Saved Tests" description="Your personalized practice tests, ready to take anytime">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 md:px-10">
          <DialogTitle className="sr-only text-[36px] leading-[43px] font-bold text-neutral-950 md:not-sr-only md:block">My Saved Tests</DialogTitle>
          <p className="hidden pt-1 text-sm text-neutral-600 md:block">Your personalized practice tests, ready to take anytime</p>
          {sets.isPending ? (
            <div className="pt-8">
              <GridSkeleton />
            </div>
          ) : sets.isError ? (
            <div className="pt-8">
              <LoadError error={sets.error} />
            </div>
          ) : sets.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
              <span className="bg-brand/12 flex size-24 items-center justify-center rounded-full">
                <ClipboardList aria-hidden className="text-brand size-10" />
              </span>
              <p className="text-2xl font-bold text-neutral-800">No Saved Tests Yet</p>
              <p className="text-[16px] text-neutral-600">Create your first custom test to start practicing</p>
              <button type="button" onClick={onCreate} className="bg-brand text-on-brand flex items-center gap-2 rounded-[20px] px-6 py-3.5 text-[16px] font-semibold">
                <Settings aria-hidden className="size-5" /> Create Your First Test
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 pb-10 md:grid-cols-3 md:pt-8">
              {sets.data.map((set) => (
                <li key={set.setId} className="border-brand-150 bg-surface flex flex-col gap-6 rounded-[20px] border-2 p-5">
                  <p className="text-[20px] leading-5 font-semibold text-neutral-950">{set.title}</p>
                  <dl className="flex flex-col gap-4 text-sm">
                    {(
                      [
                        ['Questions', set.questionCount],
                        ['Difficulty', set.difficulty],
                        ['Total Marks', set.totalMarks],
                        ['Exam Created', shortDate(set.createdAt)],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-neutral-950">{label}</dt>
                        <dd className="font-semibold text-neutral-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-col gap-5 md:flex-row">
                    <button type="button" onClick={() => setActive(set)} className={cx(button, 'bg-surface text-brand')}>
                      View Submissions
                    </button>
                    <Link href={routes.testPlayer(exam.slug, 'custom', set.setId)} className={cx(button, 'bg-brand text-on-brand')}>
                      Attempt Exam
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
      <SubmissionsDrawer set={active} onClose={() => setActive(null)} />
    </>
  );
}

function SubmissionsDrawer({ set, onClose }: { set: BoardCustomSet | null; onClose: () => void }) {
  const exam = useExam();
  const submissions = useQuery({
    queryKey: ['test-library', exam.slug, 'board-custom-submissions', set?.setId],
    queryFn: () => boardCustomApi.submissions(set!.setId),
    enabled: !!set,
  });
  return (
    <Dialog open={set !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-auto bottom-0 left-0 h-[75%] w-full max-w-none transform-none gap-0 rounded-none rounded-t-[24px] p-0 md:top-0 md:right-0 md:left-auto md:h-full md:w-[420px] md:rounded-none">
        <div className="flex items-center justify-between border-b border-neutral-200 p-5">
          <DialogTitle className="text-brand text-lg font-semibold">Submissions</DialogTitle>
          <button type="button" onClick={onClose} aria-label="Close submissions">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <DialogDescription className="sr-only">Previous attempts of {set?.title}</DialogDescription>
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          {submissions.isPending ? (
            <p>Loading submissions...</p>
          ) : submissions.isError ? (
            <LoadError error={submissions.error} />
          ) : submissions.data.length === 0 ? (
            <p>No submissions yet</p>
          ) : (
            submissions.data.map((s) => (
              <article key={s.attemptId} className="bg-surface flex flex-col gap-2 rounded-[14px] border border-neutral-200 p-4 text-sm font-medium text-neutral-950">
                <p className="font-semibold">Attempt {s.attemptNumber}</p>
                <p>
                  Score: {s.obtained} / {s.total} ({s.total > 0 ? Math.round((s.obtained / s.total) * 100) : 0}%)
                </p>
                <p>Total Questions: {s.questionCount}</p>
                <p>Submission Date : {shortDate(s.date)}</p>
                <Link
                  href={routes.testResult(exam.slug, 'custom', s.attemptId)}
                  className="border-brand text-brand bg-surface flex w-full items-center justify-center rounded-[14px] border-[1.5px] px-6 py-3.5 text-xs font-semibold"
                >
                  View Score Card
                </Link>
              </article>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
