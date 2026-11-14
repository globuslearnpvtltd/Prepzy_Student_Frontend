'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useLiveDpp } from '@/shared/layout/shell-api';
import { libraryApi } from './api';
import { EmptyState, formatDate, GridSkeleton, HubBreadcrumb, LoadError, panel } from './kit';

const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Today's paper plus every paper by month (the previous app showed these in the DPP page's sidebar). */
export function DailyPractice() {
  const exam = useExam();
  const live = useLiveDpp(exam);
  const months = useQuery({ queryKey: ['test-library', exam.slug, 'dpp-months'], queryFn: () => libraryApi.dppMonths(exam) });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const first = months.data?.[0];
    if (!selected && first) setSelected(`${first.year}-${first.month}`);
  }, [months.data, selected]);
  const [year, month] = (selected ?? '0-0').split('-').map(Number) as [number, number];
  const list = useQuery({
    queryKey: ['test-library', exam.slug, 'dpp-list', selected],
    queryFn: () => libraryApi.dppList(exam, month, year),
    enabled: !!selected,
  });
  const today = live.data;

  return (
    // As the previous app's DPP page: 22px on phones, 40px (the shell's alone) on desktop.
    <div className="flex flex-col gap-6 p-3 lg:p-0">
      <HubBreadcrumb label="Daily Practice" />
      <h1 className="text-brand text-2xl font-bold">Daily Practice</h1>

      <section className={cx(panel, 'flex flex-wrap items-center justify-between gap-4 p-6')} aria-labelledby="todays-dpp">
        <div>
          <h2 id="todays-dpp" className="text-xl font-bold">
            Today&apos;s DPP
          </h2>
          <p className="text-foreground-muted text-sm">
            {live.isPending
              ? 'Loading…'
              : today
                ? `${today.name} · ${today.questionCount} questions`
                : "There's no practice paper today. Check back tomorrow!"}
          </p>
        </div>
        {today &&
          (today.attempt?.status === 'submitted' ? (
            <Link href={routes.testResult(exam.slug, 'dpp', today.attempt.attemptId)} className="border-brand text-brand rounded-xl border px-5 py-2.5 text-sm font-semibold">
              View Results
            </Link>
          ) : (
            <Link href={routes.testPlayer(exam.slug, 'dpp', today.dppId)} className="bg-brand text-on-brand rounded-xl px-5 py-2.5 text-sm font-semibold">
              {today.attempt ? 'Resume' : 'Start Now'}
            </Link>
          ))}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="past-dpps">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="past-dpps" className="text-lg font-semibold">
            All practice papers
          </h2>
          {(months.data?.length ?? 0) > 0 && (
            <label className="bg-surface border-neutral-150 flex h-11 items-center gap-2 rounded-xl border px-4 text-sm">
              <CalendarDays aria-hidden className="text-brand size-4" />
              <span className="sr-only">Month</span>
              <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} className="text-brand bg-transparent font-semibold outline-none">
                {months.data!.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {monthLabel(m.year, m.month)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {months.isError ? (
          <LoadError error={months.error} />
        ) : months.isPending || (selected && list.isPending) ? (
          <GridSkeleton />
        ) : months.data.length === 0 ? (
          <EmptyState title="No practice papers yet" text="A new paper is published every day." />
        ) : list.isError ? (
          <LoadError error={list.error} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(list.data ?? []).map((dpp) => (
              <li key={dpp.dppId} className={cx(panel, 'flex items-center justify-between gap-3 p-5')}>
                <div>
                  <p className="font-semibold">{dpp.name}</p>
                  <p className="text-foreground-muted text-xs">{formatDate(dpp.date)}</p>
                </div>
                {dpp.attemptId ? (
                  <Link href={routes.testResult(exam.slug, 'dpp', dpp.attemptId)} className="text-success-700 flex items-center gap-1 text-sm font-semibold">
                    <CircleCheck aria-hidden className="size-4" />
                    Result
                  </Link>
                ) : (
                  <Link href={routes.testPlayer(exam.slug, 'dpp', dpp.dppId)} className="bg-brand text-on-brand rounded-lg px-4 py-2 text-sm font-semibold">
                    Start
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
