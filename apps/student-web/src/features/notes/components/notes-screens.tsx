'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useLearnContext, useSubjectCourses, useSubjects } from '@/features/learn';
import { DidYouKnow, TwoColumn } from '@/features/learn/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { Failure } from './parts';

const COURSE_FALLBACK = '/illustrations/tests/course.jpg';

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={!src || failed ? COURSE_FALLBACK : src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

/* ---------------------------------- /notes ---------------------------------- */

/** /[exam]/notes: pick a subject, then a book to read its chapter notes. */
export function NotesScreen({ aside }: { aside?: ReactNode }) {
  const exam = useExam();
  const { classId } = useLearnContext();
  const subjects = useSubjects(classId);
  const [picked, setPicked] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const subjectId = picked ?? subjects.data?.[0]?.id ?? null;
  const courses = useSubjectCourses(classId, subjectId);
  const selected = subjects.data?.find((s) => s.id === subjectId);
  const error = subjects.error ?? courses.error;

  return (
    <TwoColumn title="Notes" aside={aside}>
      {error ? (
        <Failure title="Failed To Load Notes" error={error} />
      ) : (
        <>
          <div role="group" aria-label="Subjects" className="border-brand-75 bg-surface hidden items-center gap-3 overflow-x-auto rounded-xl border-2 p-4 whitespace-nowrap md:flex">
            {subjects.isPending && classId !== null
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-full" />)
              : (subjects.data ?? []).map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={subject.id === subjectId}
                    onClick={() => setPicked(subject.id)}
                    className={cx(
                      'rounded-full px-5 py-[11px] text-[14px] leading-[14px] font-semibold',
                      subject.id === subjectId ? 'bg-brand text-on-brand' : 'border-brand-75 bg-surface border-2 text-neutral-500',
                    )}
                  >
                    {subject.name}
                  </button>
                ))}
          </div>

          <div className="border-brand-75 bg-surface rounded-xl border-2 p-5 md:hidden">
            <p className="text-neutral-850 text-[16px] leading-4 font-semibold">Select Subject</p>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="border-brand bg-brand/20 text-brand mt-4 flex w-full items-center justify-between rounded-lg border-2 px-[18px] py-4 text-[14px] leading-[14px] font-semibold"
            >
              {selected?.name ?? 'Select subject'}
              <ChevronDown aria-hidden className={cx('size-5 transition-transform', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {(subjects.data ?? []).map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => {
                      setPicked(subject.id);
                      setMenuOpen(false);
                    }}
                    className={cx(
                      'rounded-lg border-2 px-[18px] py-4 text-left text-[14px] leading-[14px] font-semibold',
                      subject.id === subjectId ? 'bg-brand text-on-brand border-brand' : 'bg-canvas border-brand-75 text-neutral-900',
                    )}
                  >
                    {subject.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ul className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {courses.isPending && subjectId
              ? [0, 1, 2].map((i) => <Skeleton key={i} aria-hidden className="h-[240px] w-full rounded-xl" />)
              : (courses.data ?? []).map((course) => (
                  <li key={course.courseId} className="border-info-50 bg-surface flex h-full flex-col gap-2.5 rounded-xl border-2 p-2.5 transition-shadow hover:shadow-lg">
                    <span className="relative block h-[93px] overflow-hidden rounded-[14px] md:h-[113px]">
                      <Cover src={course.image} />
                    </span>
                    <span className="mb-2.5 flex flex-col gap-1.5 px-2.5 md:gap-3">
                      <span className="text-neutral-850 text-[16px] leading-6 font-semibold">{course.title}</span>
                      <span className="text-[14px] leading-[14px] font-medium text-neutral-450">{course.chapterCount} Chapters</span>
                      <Link
                        href={routes.notesView(exam.slug, course.courseId)}
                        aria-label={`View Notes: ${course.title}`}
                        className="border-brand-75 text-brand flex items-center justify-center gap-2 rounded-md border px-4 py-[15px] text-[14px] leading-[14px] font-semibold"
                      >
                        View Notes <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </span>
                  </li>
                ))}
          </ul>
        </>
      )}
      <DidYouKnow />
    </TwoColumn>
  );
}
