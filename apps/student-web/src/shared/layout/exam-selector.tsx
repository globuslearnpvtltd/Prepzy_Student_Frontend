'use client';

import { cx } from '@prepzy/design-system';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, GraduationCap, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { usePurchasedExams } from '@/features/auth';
import { findExam, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';

export interface OwnedExam {
  exam: ExamConfig;
  /** Name from the backend ("NEET-UG"), as the previous app showed it. */
  name: string;
}

/** The student's purchased exams that this app knows, in backend order. */
export function useOwnedExams(): OwnedExam[] {
  const purchased = usePurchasedExams();
  return (purchased.data ?? []).flatMap((p) => {
    const exam = findExam(p.examSlice);
    return exam ? [{ exam: { ...exam, examId: p.examId }, name: p.name || exam.label }] : [];
  });
}

export function ExamIcon({ exam }: { exam: ExamConfig }) {
  const Icon = exam.category === 'competitive' ? Stethoscope : GraduationCap;
  return (
    <span className="bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-full">
      <Icon aria-hidden className="size-4" />
    </span>
  );
}

/** "ACTIVE COURSE" list: one row per purchased exam, the current one checked. */
export function ExamList({
  owned,
  current,
  onSelect,
  asMenuItems = false,
}: {
  owned: OwnedExam[];
  current: ExamConfig | null;
  onSelect?: () => void;
  asMenuItems?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {owned.map(({ exam, name }) => {
        const active = exam.slug === current?.slug;
        const row = (
          <Link
            href={routes.dashboard(exam.slug)}
            onClick={onSelect}
            aria-current={active ? 'true' : undefined}
            className={cx(
              'flex items-center gap-3 rounded-[14px] border px-3 py-2.5 outline-none',
              active ? 'border-brand/20 bg-brand/5' : 'hover:bg-brand-50 data-[highlighted]:bg-brand-50 border-transparent',
            )}
          >
            <ExamIcon exam={exam} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-neutral-950 truncate text-[14px] font-semibold">{name}</span>
              {active && <span className="text-foreground-muted text-[12px]">Currently Active</span>}
            </span>
            <span
              aria-hidden
              className={cx(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                active ? 'border-brand bg-brand text-on-brand' : 'border-neutral-200 bg-surface',
              )}
            >
              {active && <Check className="size-3" strokeWidth={3} />}
            </span>
          </Link>
        );
        return asMenuItems ? (
          <DropdownMenu.Item key={exam.slug} asChild>
            {row}
          </DropdownMenu.Item>
        ) : (
          <div key={exam.slug}>{row}</div>
        );
      })}
    </div>
  );
}

export const sectionLabel = 'text-foreground-subtle block text-[11px] font-semibold tracking-wide uppercase';

/** Header dropdown to switch between the student's exams (hidden when they own none). */
export function ExamSelector({ current, fallbackLabel }: { current: ExamConfig | null; fallbackLabel?: string }) {
  const owned = useOwnedExams();
  if (owned.length === 0) return null;
  const label = owned.find((o) => o.exam.slug === current?.slug)?.name ?? fallbackLabel ?? current?.label ?? 'Select Exam';
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Exam: ${label}. Switch exam`}
        className="bg-brand/10 border-line text-brand flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-[14px] font-semibold whitespace-nowrap data-[state=open]:[&>svg]:rotate-180"
      >
        {label}
        <ChevronDown aria-hidden className="size-[18px] transition-transform" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-line bg-surface z-50 w-[260px] rounded-lg border p-2 shadow-lg"
        >
          <DropdownMenu.Label className={cx(sectionLabel, 'px-2 pt-1 pb-2')}>Active course</DropdownMenu.Label>
          <ExamList owned={owned} current={current} asMenuItems />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
