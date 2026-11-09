'use client';

import { Skeleton, cx } from '@prepzy/design-system';
import { useState } from 'react';
import { userMessage } from '@/shared/lib/errors';
import type { Child } from '../api';
import { useChildren } from '../hooks';
import { formatSince, fullName, initials } from '../model';
import { AssessmentsCard, DoubtsCard, LearningHoursSection, LecturesCard, cardClass } from './widgets';

const pill = (active: boolean) =>
  cx('border-schools-line cursor-pointer border font-medium', active ? 'bg-brand-700 text-neutral-0' : 'bg-surface text-brand-700');

function ChildCard({ child }: { child: Child }) {
  const name = fullName(child);
  return (
    <div className={cx(cardClass, 'shadow-sm flex h-full flex-row items-center justify-between p-[16px]')}>
      <div className="flex items-center gap-[14px]">
        <span className="bg-schools-pink flex size-[48px] shrink-0 items-center justify-center rounded-full">
          <span className="text-neutral-0 text-[16px] font-bold">{initials(name)}</span>
        </span>
        <h2 className="text-neutral-900 text-[18px]/[24px] font-bold">{name}</h2>
      </div>
      <p className="text-neutral-900 text-[13px]/[19.5px] font-semibold">Since {formatSince(child.createdAt)}</p>
    </div>
  );
}

function ChildActivity({ child }: { child: Child }) {
  const [picked, setPicked] = useState<number | null>(null);
  const classId = child.classes.some((c) => c.id === picked) ? picked : (child.classes[0]?.id ?? null);

  return (
    <>
      <ChildCard child={child} />
      {child.classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-[10px]" role="group" aria-label="Class">
          {child.classes.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={classId === c.id}
              onClick={() => setPicked(c.id)}
              className={cx(pill(classId === c.id), 'rounded-[16px] px-[10px] py-[6px] text-[12px]/[20px]')}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {classId === null ? (
        <p className="text-neutral-550 text-[14px]">{child.firstName} hasn&apos;t joined a class yet.</p>
      ) : (
        <>
          <LearningHoursSection studentId={child.id} classId={classId} />
          <div>
            <h2 className="text-brand-700 text-[12px]/[16px] font-bold">Prepzy Feature Activity This Week</h2>
            <div className="mt-[20px] grid grid-cols-1 gap-[20px] md:grid-cols-3">
              <LecturesCard studentId={child.id} classId={classId} />
              <DoubtsCard studentId={child.id} classId={classId} />
              <AssessmentsCard studentId={child.id} classId={classId} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Parents dashboard: pick a child and a class, then see their week on Prepzy. */
export function ParentDashboard() {
  const children = useChildren();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const list = children.data ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? list[0] ?? null;

  return (
    <main className="mx-auto mt-[40px] pb-[40px] flex max-w-[1440px] flex-col gap-[20px] px-4 xl:px-0">
      <h1 className="text-neutral-900 mb-2 text-[26px]/[24px] font-semibold">Dashboard</h1>

      {children.isPending && (
        <div className="flex flex-col gap-[20px]" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-[34px] w-[220px]" />
          <Skeleton className="h-[80px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      )}

      {children.isError && (
        <div role="alert" className={cx(cardClass, 'flex flex-col items-start gap-3 p-[16px]')}>
          <p className="text-neutral-900 text-[14px]">{userMessage(children.error, "We couldn't load your children's details.")}</p>
          <button
            type="button"
            onClick={() => void children.refetch()}
            className="bg-brand-700 text-neutral-0 rounded-[8px] px-4 py-2 text-[14px] font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {children.isSuccess && list.length === 0 && (
        <div className={cx(cardClass, 'p-[16px]')}>
          <p className="text-neutral-900 text-[14px] font-semibold">No students linked yet</p>
          <p className="text-neutral-550 mt-1 text-[13px]">
            Ask your child to add your phone number or email in the profile section of their Prepzy app.
          </p>
        </div>
      )}

      {selected && (
        <>
          <div className="flex flex-wrap items-center gap-[10px]" role="group" aria-label="Student">
            {list.map((child) => (
              <button
                key={child.id}
                type="button"
                aria-pressed={selected.id === child.id}
                onClick={() => setSelectedId(child.id)}
                className={cx(pill(selected.id === child.id), 'rounded-[8px] px-[10px] py-[6px] text-[14px]/[24px]')}
              >
                {fullName(child)}
              </button>
            ))}
          </div>
          <ChildActivity key={selected.id} child={selected} />
        </>
      )}
    </main>
  );
}
