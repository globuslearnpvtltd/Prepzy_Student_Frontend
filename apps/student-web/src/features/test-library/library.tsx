'use client';

import { Dialog, DialogContent, DialogTitle, DialogTrigger, Spinner, Tabs, TabsList, TabsTrigger, cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, CircleCheck, Clock, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTestContext } from '@/features/exam-engine';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { libraryApi, type LibraryKind, type LibrarySet, type LibraryStatus, type MockVariant } from './api';
import { EmptyState, formatDate, formatHours, GridSkeleton, HubBreadcrumb, LoadError, panel, StatTile, StatusPill } from './kit';

const COPY: Record<LibraryKind, { title: string; crumb: string; text: string; all: string }> = {
  mock: {
    title: 'Mock Exams',
    crumb: 'Mock Exams',
    text: 'Attempt full-length mock tests or subject mock tests designed to simulate the NEET exam.',
    all: 'All Mock Tests',
  },
  pyq: {
    title: 'PYQ Library',
    crumb: 'PYQ Library',
    text: 'Solve actual NEET papers from previous years under real exam conditions.',
    all: 'All PYQ Tests',
  },
};

type Filter = 'all' | LibraryStatus;

const remaining = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return seconds <= 0 ? 'Expiring…' : h > 0 ? `${h}H ${m}M LEFT` : `${m}M LEFT`;
};

/** NEET mock tests / PYQ library (previous app's neet/mock-tests and neet/pyq-library). */
export function TestLibrary({ kind }: { kind: LibraryKind }) {
  const exam = useExam();
  const { context, isPending: planPending, error: planError } = useTestContext();
  const [variant, setVariant] = useState<MockVariant>('full');
  const [filter, setFilter] = useState<Filter>('all');
  const copy = COPY[kind];
  const classId = context?.classId ?? 0;
  const key = ['test-library', exam.slug, kind, variant] as const;
  const sets = useQuery({
    queryKey: [...key, 'sets'],
    queryFn: () => libraryApi.librarySets(exam, classId, kind, variant),
    enabled: !!context,
  });
  const best = useQuery({
    queryKey: [...key, 'best'],
    queryFn: () => libraryApi.bestScore(exam, classId, kind, variant),
    enabled: !!context,
  });
  const recent = useQuery({
    queryKey: [...key, 'recent'],
    queryFn: () => libraryApi.recentAttempts(exam, classId, kind, variant),
    enabled: !!context,
  });

  const list = sets.data ?? [];
  const shown = filter === 'all' ? list : list.filter((s) => s.status === filter);
  const ongoing = shown.filter((s) => s.status === 'in-progress');
  const rest = shown.filter((s) => s.status !== 'in-progress');

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 pt-6 lg:pt-4">
      <HubBreadcrumb label={copy.crumb} />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[32px] leading-10 font-bold text-neutral-950">{copy.title}</h1>
          <p className="text-foreground-soft text-sm">{copy.text}</p>
        </div>
        {kind === 'mock' && (
          <Tabs value={variant} onValueChange={(v) => setVariant(v as MockVariant)}>
            <TabsList aria-label="Mock test type" className="bg-surface border border-neutral-100">
              <TabsTrigger value="full" className="data-[state=active]:bg-brand data-[state=active]:text-on-brand">
                Full Mock Tests
              </TabsTrigger>
              <TabsTrigger value="subject" className="data-[state=active]:bg-brand data-[state=active]:text-on-brand">
                Subject Mock Tests
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={BookOpen} value={list.length} label="Total" />
        <StatTile icon={CircleCheck} tone="accent" value={list.filter((s) => s.status === 'completed').length} label="Completed" />
        <StatTile icon={Clock} value={list.filter((s) => s.status === 'pending').length} label="Pending" />
        <StatTile icon={Trophy} tone="accent" value={best.data ? `${best.data.obtained}/${best.data.total}` : '—'} label="Best Score" />
      </section>

      <div className="flex justify-end">
        <label className="bg-surface text-foreground-soft flex h-11 items-center gap-2 rounded-xl border border-neutral-150 px-4 text-sm">
          Status:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="text-brand bg-transparent font-semibold outline-none"
          >
            <option value="all">{copy.all}</option>
            <option value="in-progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      {planPending || sets.isPending ? (
        <GridSkeleton />
      ) : planError || sets.isError ? (
        <LoadError error={planError ?? sets.error} />
      ) : list.length === 0 ? (
        <EmptyState title="No tests yet" text="New papers are added regularly. Check back soon." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            {ongoing.map((set) => (
              <OngoingCard key={set.setId} set={set} />
            ))}
            <RecentAttempts attempts={recent.data ?? []} kind={kind} />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rest.map((set) => (
              <li key={set.setId}>
                <SetCard set={set} kind={kind} />
              </li>
            ))}
            {shown.length === 0 && <li className="text-foreground-muted text-sm">No tests match this filter.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function OngoingCard({ set }: { set: LibrarySet }) {
  const exam = useExam();
  return (
    <article className="from-accent-300 to-accent-400 text-on-brand flex flex-col gap-4 rounded-[20px] bg-linear-to-br p-6 shadow-card">
      {set.remainingSeconds !== null && (
        <span className="border-on-brand/50 bg-on-brand/20 w-fit rounded-md border px-4 py-2 text-[11px] font-bold">
          {remaining(set.remainingSeconds)}
        </span>
      )}
      <h2 className="text-2xl font-bold">{set.name}</h2>
      <p className="text-sm">Pick up where you left off, your progress is saved.</p>
      <Link
        href={routes.testPlayer(exam.slug, 'mock', set.setId)}
        className="bg-brand text-on-brand flex h-11 items-center justify-center rounded-xl text-sm font-semibold"
      >
        Resume Test
      </Link>
    </article>
  );
}

function SetCard({ set, kind }: { set: LibrarySet; kind: LibraryKind }) {
  const exam = useExam();
  const play = routes.testPlayer(exam.slug, kind, set.setId);
  const meta = [`${set.questionCount} Qs`, formatHours(set.durationMinutes), set.subjectName ?? 'All subjects'].join(' • ');
  return (
    <article className={cx(panel, 'flex h-full flex-col gap-3 p-6')}>
      <div className="flex items-start justify-between gap-2">
        <StatusPill status={set.status} />
        <p className="text-foreground-soft text-right text-sm">{meta}</p>
      </div>
      <h2 className="text-xl font-semibold text-neutral-950">{set.name}</h2>
      <p className="text-foreground-soft text-xs">
        {set.attemptCount === 0 ? 'No Attempts' : `${set.attemptCount} Attempt${set.attemptCount === 1 ? '' : 's'}`}
      </p>
      <div className="mt-auto flex gap-3">
        {set.attemptCount > 0 ? (
          <>
            <AttemptsDialog set={set} kind={kind} />
            <Link href={play} className="bg-brand text-on-brand flex h-[60px] flex-1 items-center justify-center rounded-xl text-center text-sm font-semibold">
              Attempt Again
            </Link>
          </>
        ) : (
          <Link href={play} className="bg-brand text-on-brand flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-semibold">
            Start Test
          </Link>
        )}
      </div>
    </article>
  );
}

function AttemptsDialog({ set, kind }: { set: LibrarySet; kind: LibraryKind }) {
  const exam = useExam();
  const [open, setOpen] = useState(false);
  const attempts = useQuery({
    queryKey: ['test-library', exam.slug, kind, 'attempts', set.setId],
    queryFn: () => libraryApi.setAttempts(exam, kind, set.setId),
    enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="border-neutral-150 flex h-[60px] flex-1 items-center justify-center rounded-xl border text-center text-sm font-semibold"
        >
          View Attempts
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{set.name}</DialogTitle>
        {attempts.isPending ? (
          <Spinner label="Loading attempts" />
        ) : attempts.isError ? (
          <LoadError error={attempts.error} />
        ) : (
          <RecentAttempts attempts={attempts.data} kind={kind} title="Your attempts" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecentAttempts({
  attempts,
  kind,
  title = 'Previous submissions',
}: {
  attempts: { attemptId: string; name: string; obtained: number; total: number; date: string | null }[];
  kind: LibraryKind;
  title?: string;
}) {
  const exam = useExam();
  if (attempts.length === 0) return null;
  return (
    <section className={cx(panel, 'flex flex-col gap-4 p-4')} aria-label={title}>
      <h2 className="border-neutral-150 border-b pb-3 text-lg font-bold">{title}</h2>
      <ul className="flex flex-col gap-3">
        {attempts.map((a) => (
          <li key={a.attemptId} className="border-neutral-150 flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="text-lg font-semibold">{a.name}</p>
              <p className="text-foreground-soft flex items-center gap-1.5 text-sm font-medium">
                <Calendar aria-hidden className="size-3.5" />
                {formatDate(a.date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-foreground-muted text-sm">
                Marks: <span className="text-foreground font-semibold">{a.obtained} / {a.total}</span>
              </p>
              <Link
                href={routes.testResult(exam.slug, kind, a.attemptId)}
                className="border-neutral-150 bg-canvas text-brand rounded-lg border px-6 py-1 text-sm font-semibold"
              >
                Review
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
