'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronLeft, CircleCheck, FilePenLine, FileText, Lightbulb, Loader, Pause } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContinueAssessment, SolverDiscovery, SyllabusCards } from '@/features/dashboard';
import { useTestContext } from '@/features/exam-engine';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { boardSubjectArt } from '@/shared/ui/subject-art';
import { BoardCustomTestBuilder, BoardSavedTests } from './board-custom';
import { libraryApi, type BoardPaper, type BoardPaperKind } from './api';
import { EmptyState, GridSkeleton, LoadError, pad2 } from './kit';

const KIND_COPY: Record<BoardPaperKind, { tab: string; title: string; text: string; page: string }> = {
  mock: {
    tab: 'Mock Exams',
    title: 'Mock Exams',
    text: 'Timed CBSE mock exams per subject with detailed, personalized feedback after every attempt.',
    page: 'Mock Exams',
  },
  pyq: {
    tab: 'Past Year Exams',
    title: 'Past Year Exams',
    text: 'Actual CBSE board papers from previous years, evaluated like the real exam.',
    page: 'Previous Year Papers',
  },
};

const setsRoute = (kind: BoardPaperKind, exam: string, subjectId: string) =>
  kind === 'mock' ? routes.mockSets(exam, subjectId) : routes.pyqSets(exam, subjectId);

/** CBSE Assessments hub (previous app's [exam]/(dashboard)/assessments). */
export function BoardAssessments() {
  const [sheet, setSheet] = useState<'create' | 'saved' | null>(null);
  // Study-plan tasks link here with ?open=custom-test to open the builder straight away (as before).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('open') !== 'custom-test') return;
    setSheet('create');
    url.searchParams.delete('open');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, []);
  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <div className="flex w-full flex-col gap-[30px] md:w-[70%] md:gap-10">
        <h1 className="md:text-brand text-[28px] leading-7 font-bold text-neutral-950 md:text-[64px] md:leading-[64px]">
          Assessments
        </h1>
        <section className="border-brand-150 bg-brand-50 flex flex-col gap-5 rounded-[20px] border-2 p-6" aria-labelledby="custom-practice">
          <p className="bg-brand-100 text-brand w-fit rounded-full p-3 text-xs leading-3 font-semibold">CUSTOM PRACTICE</p>
          <div className="flex flex-col gap-3">
            <h2 id="custom-practice" className="text-xl leading-5 font-bold text-neutral-950">
              Build Your Own Test
            </h2>
            <p className="text-sm">Select specific chapters and topics (e.g., 4-5 topics) to build a dynamic test.</p>
          </div>
          <div className="flex flex-col gap-5 md:flex-row">
            <button
              type="button"
              onClick={() => setSheet('create')}
              className="bg-brand text-on-brand flex w-full items-center justify-center rounded-2xl px-6 py-4 text-sm font-semibold"
            >
              Customize Test
            </button>
            <button
              type="button"
              onClick={() => setSheet('saved')}
              className="border-brand text-brand bg-surface flex w-full items-center justify-center rounded-2xl border px-6 py-4 text-sm font-semibold"
            >
              Saved Tests
            </button>
          </div>
          <BoardCustomTestBuilder open={sheet === 'create'} onOpenChange={(open) => setSheet(open ? 'create' : null)} />
          <BoardSavedTests open={sheet === 'saved'} onOpenChange={(open) => setSheet(open ? 'saved' : null)} onCreate={() => setSheet('create')} />
        </section>
        <ContinueAssessment />
        <FullLengthExams />
        <aside className="border-accent-400 bg-accent-50 flex items-center gap-4 rounded-[20px] border-2 p-2.5 md:p-5">
          <span className="bg-surface rounded-full p-2.5">
            <Lightbulb aria-hidden className="text-accent-400 size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[16px] leading-6 font-bold text-neutral-800">Did you know?</p>
            <p className="text-[16px] leading-6 text-neutral-700 italic">
              &quot;The speed of light can actually slow down when passing through water or glass!&quot;
            </p>
          </div>
        </aside>
      </div>
      <div className="flex w-full flex-col gap-5 md:w-[30%]">
        <SolverDiscovery />
        <SyllabusCards />
      </div>
    </div>
  );
}

function FullLengthExams() {
  const exam = useExam();
  const { context } = useTestContext();
  const [kind, setKind] = useState<BoardPaperKind>('mock');
  const subjects = useQuery({
    queryKey: ['test-library', exam.slug, 'board-subjects', kind, context?.classId],
    queryFn: () => libraryApi.boardSubjects(exam, context!.classId, kind),
    enabled: !!context,
  });
  const copy = KIND_COPY[kind];
  return (
    <section className="flex flex-col gap-4" aria-labelledby="full-length">
      <h2 id="full-length" className="text-neutral-850 text-[16px] leading-6 font-semibold md:text-[20px]">
        Full Length Practice Exams
      </h2>
      <div role="tablist" aria-label="Exam type" className="border-neutral-150 bg-surface grid grid-cols-2 gap-2 rounded-[20px] border-2 p-2">
        {(['mock', 'pyq'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              'rounded-[14px] py-3 text-[16px] font-medium md:text-lg',
              kind === k ? 'border-brand bg-brand-150 text-brand border-2' : 'text-neutral-900',
            )}
          >
            {KIND_COPY[k].tab}
          </button>
        ))}
      </div>
      <div className="border-brand bg-surface flex items-center gap-6 rounded-[20px] border-2 border-l-8 p-6">
        <span className="border-neutral-150 flex size-[79px] shrink-0 items-center justify-center rounded-full border-2">
          <FilePenLine aria-hidden className="text-brand size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-brand text-[20px] leading-5 font-bold">{copy.title}</p>
          <p className="text-sm font-medium text-neutral-900">{copy.text}</p>
        </div>
      </div>
      {subjects.isPending ? (
        <GridSkeleton />
      ) : subjects.isError ? (
        <LoadError error={subjects.error} />
      ) : subjects.data.length === 0 ? (
        <EmptyState title="Coming Soon..." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {subjects.data.map((subject) => {
            const art = boardSubjectArt(subject.title);
            return (
              <li key={subject.id}>
                <Link
                  href={setsRoute(kind, exam.slug, subject.id)}
                  className="border-neutral-150 bg-surface relative flex h-[150px] flex-col gap-1 overflow-hidden rounded-[20px] border-2 p-5 hover:shadow-card"
                >
                  <span className="text-lg font-bold text-neutral-900 capitalize">{subject.title.toLowerCase()}</span>
                  <span className="text-sm font-bold text-neutral-900">{subject.count} Exams</span>
                  <Image
                    src={art.src}
                    alt=""
                    width={art.width}
                    height={art.height}
                    className="absolute opacity-80"
                    style={{ bottom: art.bottom, right: art.right, left: art.left }}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* --------------------------- mock / PYQ paper sets ------------------------- */

const STAT_TILES = [
  { key: 'total', label: 'Total Papers', icon: FileText, tone: 'brand' },
  { key: 'completed', label: 'Completed', icon: CircleCheck, tone: 'accent' },
  { key: 'inProgress', label: 'In Progress', icon: Loader, tone: 'brand' },
  { key: 'pending', label: 'Pending', icon: Pause, tone: 'accent' },
] as const;

const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
];

/** Papers of one subject (previous app's mock-sets / pyq-sets pages). */
export function BoardPaperSets({ kind, subjectId }: { kind: BoardPaperKind; subjectId: string }) {
  const exam = useExam();
  const { context, error: planError } = useTestContext();
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState(subjectId);
  const query = useQuery({
    queryKey: ['test-library', exam.slug, 'board-papers', kind, subject, status, context?.classId],
    queryFn: () => libraryApi.boardPapers(exam, kind, subject, context!.classId, status || undefined),
    enabled: !!context,
  });
  const select = 'border-neutral-150 bg-surface h-11 rounded-full border px-4 text-sm font-semibold';

  return (
    <div className="flex flex-col">
      <div className="bg-surface flex flex-col gap-6 px-5 pt-8 pb-10 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link href={routes.assessments(exam.slug)} aria-label="Back to Assessments" className="border-neutral-150 flex size-10 items-center justify-center rounded-full border">
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="text-[28px] font-semibold text-neutral-950">{KIND_COPY[kind].page}</h1>
          <div className="flex gap-2">
            {(query.data?.subjects.length ?? 0) > 1 && (
              <select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={select}>
                {query.data!.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
          {STAT_TILES.map(({ key, label, icon: Icon, tone }) => (
            <div
              key={key}
              className={cx(
                'flex flex-col gap-3 rounded-[20px] border-2 p-5 md:p-7',
                tone === 'brand' ? 'border-brand-150 bg-canvas' : 'border-accent-100 bg-accent-50',
              )}
            >
              <span className={cx('text-on-brand flex size-10 items-center justify-center rounded-lg', tone === 'brand' ? 'bg-brand' : 'bg-accent-400')}>
                <Icon aria-hidden className="size-5" />
              </span>
              <dt className="text-foreground-subtle text-[16px]">{label}</dt>
              <dd className="text-[30px] leading-8 font-bold text-neutral-900">{pad2(query.data?.stats[key] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-canvas border-neutral-150 border-t px-5 py-12 md:px-10">
        {planError || query.isError ? (
          <LoadError error={planError ?? query.error} />
        ) : query.isPending ? (
          <GridSkeleton />
        ) : query.data.papers.length === 0 ? (
          <EmptyState title="No papers found" text="Try adjusting your filters or check back later" />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {query.data.papers.map((paper) => (
              <li key={paper.setId}>
                <PaperCard paper={paper} kind={kind} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const STATUS_ICON = { completed: CircleCheck, 'in-progress': Loader, pending: Pause } as const;

function PaperCard({ paper, kind }: { paper: BoardPaper; kind: BoardPaperKind }) {
  const exam = useExam();
  const Icon = STATUS_ICON[paper.status];
  const play = routes.testPlayer(exam.slug, kind, paper.setId);
  const percent = paper.maxScore > 0 && paper.lastScore !== null ? Math.round((paper.lastScore / paper.maxScore) * 100) : 0;
  const rows: [string, string][] = [
    ['Duration', paper.durationLabel ? paper.durationLabel.replace(/hrs?/i, 'Hours') : '3 Hours'],
    ['Total questions', String(paper.questionCount)],
    ['Max Score', String(paper.maxScore)],
  ];
  if (paper.status === 'completed' && paper.lastAttemptedAt)
    rows.push(['Last Attempted', new Date(paper.lastAttemptedAt).toLocaleDateString('en-GB')]);
  const button = 'flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-semibold';
  return (
    <article className="border-neutral-150 bg-surface flex h-full flex-col gap-4 rounded-[20px] border-2 p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="flex gap-2">
          <span className="bg-brand text-on-brand rounded-lg px-3 py-2 text-xs font-semibold uppercase">{exam.label}</span>
          <span className="border-neutral-150 text-brand rounded-lg border-2 px-3 py-2 text-xs font-semibold">
            {paper.year ? paper.year : `SET ${paper.setNumber}`}
          </span>
        </div>
        <span className="bg-accent-400 text-on-brand flex size-10 items-center justify-center rounded-lg" aria-label={paper.status}>
          <Icon aria-hidden className="size-5" />
        </span>
      </div>
      <h2 className="text-2xl font-semibold text-neutral-950">{paper.subject}</h2>
      <dl className="flex flex-col gap-3 text-[16px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-neutral-900">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {paper.status === 'completed' && paper.lastScore !== null && (
        <div className="border-accent-400 bg-danger-50 flex items-end justify-between rounded-[14px] border-2 px-5 py-3">
          <div>
            <p className="text-[30px] leading-9 font-semibold">
              {paper.lastScore}/{paper.maxScore}
            </p>
            <p className="text-sm">Marks scored</p>
          </div>
          <div className="text-right">
            <p className="text-success-700 text-[30px] leading-9 font-semibold">{percent}%</p>
            <p className="text-sm">{paper.attempts} attempts</p>
          </div>
        </div>
      )}
      {paper.status === 'in-progress' && (
        <div className="border-neutral-150 bg-canvas flex items-center gap-4 rounded-[14px] border-2 p-3">
          <span className="bg-brand text-on-brand flex size-16 items-center justify-center rounded-xl">
            <BarChart3 aria-hidden className="size-8" />
          </span>
          <div className="flex-1">
            <p className="text-lg font-semibold">Your Progress</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="bg-brand-150 h-1.5 flex-1 rounded-full">
                <div className="bg-brand h-full rounded-full" style={{ width: `${paper.progress ?? 0}%` }} />
              </div>
              <span className="text-xs">{paper.progress ?? 0}%</span>
            </div>
          </div>
        </div>
      )}
      <div className="mt-auto flex gap-5">
        {paper.status === 'completed' ? (
          <>
            {paper.attemptId && (
              <Link href={routes.testResult(exam.slug, kind, paper.attemptId)} className={cx(button, 'border-brand bg-brand-50 text-brand border')}>
                Review
              </Link>
            )}
            <Link href={play} className={cx(button, 'bg-brand text-on-brand')}>
              Retake
            </Link>
          </>
        ) : (
          <Link href={play} className={cx(button, 'border-brand bg-brand-50 text-brand border')}>
            {paper.status === 'in-progress' ? 'Continue' : 'Start Now'}
          </Link>
        )}
      </div>
    </article>
  );
}
