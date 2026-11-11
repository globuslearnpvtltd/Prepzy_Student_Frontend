'use client';

import { Alert, Button, Spinner, cx } from '@prepzy/design-system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, ClipboardList } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { competitiveSubjectArt } from '@/shared/ui/subject-art';
import { libraryApi, type CustomSubject, type Difficulty } from './api';
import { formatDate, GridSkeleton, LoadError, panel } from './kit';

const STEPS = [
  { title: 'Pick a subject and one chapter', text: 'Physics, Chemistry, Botany or Zoology' },
  { title: 'Choose the topics', text: 'Select at least 1 topic and up-to maximum of 5' },
  { title: 'Set the difficulty level', text: 'Choose from Easy, Medium, Hard' },
];

/** NEET custom tests: build one, take a saved one, review past attempts (previous app's neet/custom-test). */
export function CustomTests() {
  const exam = useExam();
  const [tab, setTab] = useState<'saved' | 'past'>('saved');
  const saved = useQuery({ queryKey: ['test-library', exam.slug, 'custom-saved'], queryFn: () => libraryApi.savedCustomTests(exam) });
  const past = useQuery({ queryKey: ['test-library', exam.slug, 'custom-past'], queryFn: () => libraryApi.pastCustomAttempts(exam) });
  // Saved = built but never finished (the previous app showed attempted ones under Past exams).
  const savedList = (saved.data ?? []).filter((s) => s.attemptCount === 0 || s.inProgress);
  const create = routes.customTestCreate(exam.slug);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 pt-6 lg:pt-4">
      <header>
        <h1 className="text-[32px] leading-10 font-bold text-neutral-900">Custom Tests</h1>
        <p className="text-brand-950/80 text-[16px]">Make your own practice test from any chapter, or pick up a test you saved earlier.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="from-brand-400 to-brand-800 text-on-brand flex flex-col gap-6 rounded-[24px] bg-linear-to-br p-5 shadow-card">
          <div className="flex items-center gap-4">
            <span className="bg-on-brand/20 flex size-10 items-center justify-center rounded-lg">
              <ClipboardList aria-hidden className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">Build your own test</h2>
          </div>
          <p className="text-on-brand/85 text-sm">Create your custom test and improve your weak topics</p>
          <div>
            <p className="text-on-brand/70 mb-3 text-[11px] font-semibold tracking-wider">HOW IT WORKS</p>
            <ol className="flex flex-col">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-on-brand/15 flex items-center gap-4 border-b py-3 last:border-b-0">
                  <span className="border-on-brand flex size-7 shrink-0 items-center justify-center rounded-full border text-xs">{i + 1}</span>
                  <span>
                    <span className="block text-[16px] font-medium">{step.title}</span>
                    <span className="text-on-brand/70 text-xs">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <Link href={create} className="bg-accent-400 text-brand-950 mt-auto flex w-fit items-center gap-2 rounded-full px-6 py-4 text-[16px] font-semibold">
            Create a custom test
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>

        <section className={cx(panel, 'flex flex-col gap-4 p-5')}>
          <div role="tablist" aria-label="Your custom tests" className="bg-brand-50 grid grid-cols-2 gap-1 rounded-full p-1">
            {(
              [
                ['saved', 'Saved exams', savedList.length],
                ['past', 'Past exams', past.data?.length ?? 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cx('flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold', tab === key ? 'bg-brand text-on-brand' : 'text-brand')}
              >
                {label}
                <span className={cx('rounded-full px-2 text-[11px]', tab === key ? 'bg-on-brand/20' : 'bg-brand-100')}>{count}</span>
              </button>
            ))}
          </div>
          {tab === 'saved' ? (
            <>
              <p className="text-foreground-muted text-sm">Tests you saved to take later. Tap topics to see what each one covers.</p>
              {saved.isPending ? (
                <GridSkeleton count={1} />
              ) : saved.isError ? (
                <LoadError error={saved.error} />
              ) : savedList.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="bg-brand-75 flex size-14 items-center justify-center rounded-full">
                    <Bookmark aria-hidden className="text-brand size-5" />
                  </span>
                  <p className="text-xl font-semibold">No saved tests yet</p>
                  <p className="text-foreground-muted max-w-xs text-sm">After you create a test, choose Save for later and it will wait for you here.</p>
                  <Link href={create} className="bg-brand text-on-brand mt-6 flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold">
                    Create your first test
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {savedList.map((test) => (
                    <li key={test.setId} className="border-neutral-150 flex items-center justify-between gap-3 rounded-xl border p-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{test.title}</p>
                        <p className="text-foreground-muted text-xs">
                          {test.subject} · {test.questionCount} Qs · <span className="capitalize">{test.difficulty}</span>
                        </p>
                        {test.topics.length > 0 && <p className="text-foreground-muted truncate text-xs">{test.topics.join(', ')}</p>}
                      </div>
                      <Link href={routes.testPlayer(exam.slug, 'custom', test.setId)} className="bg-brand text-on-brand shrink-0 rounded-lg px-4 py-2 text-sm font-semibold">
                        {test.inProgress ? 'Resume' : 'Start'}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : past.isPending ? (
            <GridSkeleton count={1} />
          ) : past.isError ? (
            <LoadError error={past.error} />
          ) : past.data.length === 0 ? (
            <p className="text-foreground-muted py-8 text-center text-sm">You haven&apos;t finished a custom test yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {past.data.map((a) => (
                <li key={a.attemptId} className="border-neutral-150 flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-foreground-muted text-xs">
                      {a.subject} · Attempt {a.attemptNumber} · {formatDate(a.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm">
                      Marks: <span className="font-semibold">{a.obtained} / {a.total}</span>
                    </p>
                    <div className="flex gap-2">
                      <Link href={routes.testResult(exam.slug, 'custom', a.attemptId)} className="border-neutral-150 text-brand rounded-lg border px-3 py-1 text-xs font-semibold">
                        Review
                      </Link>
                      <Link href={routes.testPlayer(exam.slug, 'custom', a.setId)} className="bg-brand text-on-brand rounded-lg px-3 py-1 text-xs font-semibold">
                        Retake
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- create -------------------------------- */

const MAX_TOPICS = 5;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const STEP_LABELS = ['Subject', 'Chapter', 'Topics'];

/** Subject → chapter → topics + difficulty → generate → player (previous app's neet/custom-test/create). */
export function CustomTestCreate() {
  const exam = useExam();
  const router = useRouter();
  const [subject, setSubject] = useState<CustomSubject | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [step, setStep] = useState(0);

  const subjects = useQuery({ queryKey: ['test-library', exam.slug, 'custom-subjects'], queryFn: () => libraryApi.customSubjects(exam) });
  const chapters = useQuery({
    queryKey: ['test-library', exam.slug, 'custom-chapters', subject?.id],
    queryFn: () => libraryApi.customChapters(exam, subject!.id),
    enabled: !!subject && step >= 1,
  });
  const topicList = useQuery({
    queryKey: ['test-library', exam.slug, 'custom-topics', chapterId],
    queryFn: () => libraryApi.customTopics(exam, chapterId!),
    enabled: !!chapterId && step >= 2,
  });
  const generate = useMutation({
    mutationFn: () => libraryApi.generateCustomTest(exam, { moduleId: chapterId!, lectureIds: topics, difficulty }),
    onSuccess: ({ setId }) => {
      if (setId) router.push(routes.testPlayer(exam.slug, 'custom', setId));
    },
  });

  const canContinue = step === 0 ? !!subject : step === 1 ? !!chapterId : topics.length > 0;
  const summary =
    step === 0
      ? subject
        ? { title: subject.name, text: 'Next: pick a chapter' }
        : { title: 'No subject selected', text: 'Pick one subject to continue' }
      : step === 1
        ? chapterId
          ? { title: chapters.data?.find((c) => c.id === chapterId)?.name ?? '', text: 'Next: choose topics' }
          : { title: 'No chapter selected', text: 'Pick one chapter to continue' }
        : { title: `${topics.length} of ${MAX_TOPICS} topics selected`, text: 'Choose the difficulty and create your test' };

  const choice = (selected: boolean) =>
    cx('bg-surface flex items-center justify-between gap-3 rounded-2xl border p-5 text-left', selected ? 'border-brand ring-brand ring-1' : 'border-neutral-150');
  const tick = (selected: boolean) => (
    <span aria-hidden className={cx('flex size-7 shrink-0 items-center justify-center rounded-full border', selected ? 'bg-brand border-brand text-on-brand' : 'border-brand-300')}>
      {selected && <Check className="size-4" />}
    </span>
  );

  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-6 pt-6 pb-32 lg:pt-4">
      <div className="bg-surface flex items-center justify-between gap-4 rounded-2xl p-2 pr-4 shadow-sm">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (step === 0 ? router.push(routes.customTest(exam.slug)) : setStep(step - 1))}
          className="bg-brand-75 text-brand flex size-10 items-center justify-center rounded-full"
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <ol className="flex items-center gap-3 text-sm" aria-label="Steps">
          {STEP_LABELS.map((label, i) => (
            <li key={label} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
              {i > 0 && <span aria-hidden className="bg-neutral-150 hidden h-px w-8 sm:block" />}
              <span className={cx('flex size-7 items-center justify-center rounded-full text-xs font-semibold', i <= step ? 'bg-brand text-on-brand' : 'bg-brand-75 text-foreground-muted')}>
                {i + 1}
              </span>
              <span className={cx('hidden font-semibold sm:inline', i === step ? 'text-brand' : 'text-foreground-muted font-medium')}>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <section aria-labelledby="pick-subject" className="flex flex-col gap-4 px-5">
          <div>
            <h1 id="pick-subject" className="text-2xl font-semibold text-neutral-900">Which subject do you want to practise?</h1>
            <p className="text-foreground-soft">Pick one subject. Next you will pick a chapter and its topics.</p>
          </div>
          {subjects.isPending ? (
            <GridSkeleton count={4} />
          ) : subjects.isError ? (
            <LoadError error={subjects.error} />
          ) : (
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {subjects.data.map((s) => {
                const art = competitiveSubjectArt(s.name);
                const selected = subject?.name === s.name;
                return (
                  <li key={s.name}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSubject(s);
                        setChapterId(null);
                        setTopics([]);
                      }}
                      className={cx(choice(selected), 'relative h-[214px] w-full items-start overflow-hidden')}
                    >
                      <span>
                        <span className="block text-[28px] font-medium">{s.name}</span>
                        <span className="text-foreground-muted text-sm">{s.chapterCount} chapters</span>
                      </span>
                      {tick(selected)}
                      {art && (
                        <Image src={art.src} alt="" width={art.width} height={art.height} className="pointer-events-none absolute opacity-60" style={{ bottom: art.bottom, right: art.right, left: art.left }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="pick-chapter" className="flex flex-col gap-4 px-5">
          <h1 id="pick-chapter" className="text-2xl font-semibold text-neutral-900">Pick one {subject?.name} chapter</h1>
          {chapters.isPending ? (
            <GridSkeleton />
          ) : chapters.isError ? (
            <LoadError error={chapters.error} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {chapters.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={chapterId === c.id}
                    onClick={() => {
                      setChapterId(c.id);
                      setTopics([]);
                    }}
                    className={cx(choice(chapterId === c.id), 'w-full')}
                  >
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="text-foreground-muted text-xs">{c.topicCount} topics</span>
                    </span>
                    {tick(chapterId === c.id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="pick-topics" className="flex flex-col gap-4 px-5">
          <div>
            <h1 id="pick-topics" className="text-2xl font-semibold text-neutral-900">Choose the topics</h1>
            <p className="text-foreground-soft">Select at least 1 topic and up to {MAX_TOPICS}.</p>
          </div>
          {topicList.isPending ? (
            <GridSkeleton />
          ) : topicList.isError ? (
            <LoadError error={topicList.error} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {topicList.data.map((t) => {
                const selected = topics.includes(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && topics.length >= MAX_TOPICS}
                      onClick={() => setTopics(selected ? topics.filter((id) => id !== t.id) : [...topics, t.id])}
                      className={cx(choice(selected), 'w-full disabled:opacity-50')}
                    >
                      <span className="font-medium">{t.title}</span>
                      {tick(selected)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">Difficulty level</legend>
            <div className="flex gap-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={cx('rounded-full border px-5 py-2 text-sm font-semibold capitalize', difficulty === d ? 'bg-brand text-on-brand border-brand' : 'border-neutral-150 bg-surface')}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          {generate.isError && <Alert tone="danger">{userMessage(generate.error)}</Alert>}
          {generate.data && !generate.data.setId && (
            <Alert tone="warning">{generate.data.message ?? 'No questions are available for these topics yet.'}</Alert>
          )}
        </section>
      )}

      <footer className="bg-surface shadow-bar-up fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 px-6 py-4 lg:left-[76px]">
        <div>
          <p className="text-lg font-semibold">{summary.title}</p>
          <p className="text-foreground-subtle text-sm">{summary.text}</p>
        </div>
        {step < 2 ? (
          <Button size="lg" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Continue
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button size="lg" disabled={!canContinue} loading={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Spinner size="sm" label="Creating" /> : null}
            Create test
          </Button>
        )}
      </footer>
    </div>
  );
}
