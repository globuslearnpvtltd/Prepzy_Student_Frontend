'use client';

import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { useExam } from '@/shared/hooks/use-exam';
import { syllabusCards, type SyllabusKind } from '../api';
import { SyllabusSubjectPicker } from './subject-picker';

/**
 * "Syllabus" and "PYQ Trends" cards (previous app's SyllabusTrendSection) in the right column of the board dashboard,
 * Learn, Notes and Assessments. Each button opens the subject picker; shown by class (see syllabusCards).
 */
export function SyllabusCards() {
  const exam = useExam();
  const plan = useActivePlan(exam);
  // The kind stays while the picker closes, so its title doesn't change during the close animation.
  const [picker, setPicker] = useState<{ kind: SyllabusKind; open: boolean }>({ kind: 'syllabus', open: false });
  const { syllabus, trends } = syllabusCards(plan.data?.className);
  if (!syllabus && !trends) return null;
  const box = 'border-line bg-surface mt-5 flex w-full flex-col gap-3 rounded-xl border-2 p-3.5 shadow-lg md:p-6';
  const button =
    'bg-brand hover:bg-brand-deep text-on-brand flex w-full items-center justify-center gap-2 rounded-[16.4px] px-2 py-3.5 text-[12px] leading-[14px] font-semibold transition-colors duration-200';
  return (
    <section aria-label="Syllabus and trends" className="mb-[50px] flex flex-col gap-2.5 md:mb-0">
      {syllabus && (
        <div className={box}>
          <div className="flex flex-col gap-2.5">
            <h2 className="text-neutral-850 text-[20px] leading-5 font-semibold">Syllabus</h2>
            <p className="text-[14px] leading-[19px] text-neutral-800">Always updated with your latest syllabus.</p>
          </div>
          <button type="button" onClick={() => setPicker({ kind: 'syllabus', open: true })} className={button}>
            <BookOpen aria-hidden className="size-4" />
            View Syllabus
          </button>
        </div>
      )}
      {trends && (
        <div className={box}>
          <div className="flex flex-col gap-2.5">
            <h2 className="text-neutral-850 text-[20px] leading-5 font-semibold">PYQ Trends</h2>
            <p className="text-[14px] leading-[19px] text-neutral-800">Curated analysis of past year exams focused on top ranks.</p>
          </div>
          <button type="button" onClick={() => setPicker({ kind: 'trend', open: true })} className={button}>
            View Trend Analysis
          </button>
        </div>
      )}
      <SyllabusSubjectPicker
        kind={picker.kind}
        open={picker.open}
        onOpenChange={(open) => setPicker((current) => ({ ...current, open }))}
      />
    </section>
  );
}
