'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import {
  activityHref,
  formatTitle,
  learnApi,
  titleCase,
  toChapterAttempt,
  type Activity,
  type CourseAssessmentOverview,
  type CourseAttempt,
  type CourseExamSet,
} from '../api';
import { learnKeys, useCourseOutline } from '../hooks';
import { AssessmentRing, ExamBannerArt } from './assessment-art';
import { AttemptsDrawer } from './attempts-drawer';
import { Breadcrumb, SectionError } from './kit';

// The page between a course and the test player (previous app's learns/course/:id/assessments/:type/:id):
// FinalAssessmentComponent / MidAssessmentComponent (sets of the paper) and QuizUnitAssessmentComponent (details and
// submissions of a quiz / unit test), with the course's Previous / Next.

const SUBMITTED_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

const submittedOn = (iso: string | null) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', SUBMITTED_DATE) : null;
};

const percentOf = (attempt: CourseAttempt) => (attempt.marksObtained / (attempt.totalMarks || 1)) * 100;

/** How much the latest attempt beat (or trailed) the one before it, in %; null for a first attempt. */
export function improvementOf(latest: CourseAttempt | undefined, attempts: CourseAttempt[]): number | null {
  if (!latest || attempts.length < 2) return null;
  const previous = attempts.find((a) => a.attemptNumber === latest.attemptNumber - 1);
  if (!previous) return null;
  const now = percentOf(latest);
  const before = percentOf(previous);
  return before > 0 ? ((now - before) / before) * 100 : now - before;
}

/** Instructions cut to two lines with Read More / Show Less (previous app's ReadMoreText). */
function ReadMoreText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);
  return (
    <div className="mt-4 mb-6">
      <p ref={ref} className={cx('text-[16px] leading-[22px] font-medium text-neutral-850', !expanded && 'line-clamp-2')}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="text-info-600 mt-1 text-sm font-medium">
          {expanded ? 'Show Less' : 'Read More'}
        </button>
      )}
    </div>
  );
}

function NoSets({ type }: { type: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <Image src="/illustrations/learn/no-exams.png" alt="" width={300} height={203} className="h-auto w-[300px] max-w-full" />
      <p className="text-center text-[20px] font-bold text-neutral-900 md:text-[26px]">
        Our academic experts are putting the finishing touches on this {titleCase(type) || 'Exam'}. It&apos;ll be live very soon!
      </p>
    </div>
  );
}

const cardTitle = 'm-0 border-[1.5px] border-info-50 bg-info-25 rounded-[20px] px-6 py-4 text-[20px] leading-6 font-bold text-neutral-900 md:text-[24px]';
const statLabel = 'text-[16px] leading-5 font-bold text-neutral-625 md:text-[18px]';
const statValue = 'text-[14px] leading-[14px] font-semibold text-neutral-625';
const SECTIONS_PER_PAGE = 2;

/** Mid-term / final: the paper's sets, one at a time. */
function SetsView({ data, onViewSubmissions }: { data: Extract<CourseAssessmentOverview, { kind: 'sets' }>; onViewSubmissions: (set: CourseExamSet) => void }) {
  const exam = useExam();
  const [selected, setSelected] = useState(0);
  const [first, setFirst] = useState(0);
  const { assessment, sets, testType } = data;
  const set = sets[Math.min(selected, sets.length - 1)];
  const last = set?.attempts[0];
  const sections = set?.sections.slice(first, first + SECTIONS_PER_PAGE) ?? [];
  const time = set?.duration ?? (set?.timeLimitMinutes ? `${set.timeLimitMinutes} mins` : '--');

  return (
    <div className="mx-auto w-full max-w-[846px]">
      <div className="mb-6 flex flex-col items-center">
        <div className="bg-brand relative mb-6 w-full overflow-hidden rounded-[20px] p-6">
          <div className="flex flex-col gap-2.5 md:gap-3.5">
            <p className="text-on-brand m-0 text-[14px] leading-5 font-semibold md:text-[20px]">{titleCase(assessment.type)}</p>
            <h1 className="text-on-brand m-0 text-[24px] leading-[26px] font-extrabold md:text-[56px] md:leading-[56px]">
              {titleCase(assessment.subjectName)}
            </h1>
          </div>
          <ExamBannerArt className="text-on-brand absolute top-1/2 right-0 hidden h-auto w-1/2 -translate-y-1/2 md:block" />
        </div>

        {sets.length > 0 && (
          <div
            role="tablist"
            aria-label="Sets"
            className={cx('border-info-100 flex w-full gap-1.5 rounded-full border-2 p-1.5', sets.length > 10 && 'overflow-x-auto')}
          >
            {sets.map((s, index) => (
              <button
                key={s.setId}
                type="button"
                role="tab"
                aria-selected={index === selected}
                onClick={() => {
                  setSelected(index);
                  setFirst(0);
                }}
                className={cx(
                  'rounded-full border-2 px-3 py-4 text-center text-[16px] leading-4',
                  sets.length > 10 ? 'min-w-[100px]' : 'flex-1',
                  index === selected ? 'bg-brand border-brand text-on-brand font-semibold' : 'text-info-150 border-transparent font-medium',
                )}
              >
                Set {s.setNumber}
              </button>
            ))}
          </div>
        )}
      </div>

      {!set ? (
        <NoSets type={assessment.type} />
      ) : (
        <>
          <p className="border-info-50 bg-surface rounded-[20px] border-2 p-6 text-[16px] leading-5 font-medium text-neutral-900">
            Question Paper contains {set.totalQuestions} Questions. All Questions are compulsory. Question Paper comprises{' '}
            {set.sectionCount || set.sections.length} Sections - including diverse areas.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <section aria-label="Exam Details" className="border-info-50 bg-surface rounded-[20px] border-[1.5px]">
              <h2 className={cardTitle}>Exam Details</h2>
              <div className="flex justify-between gap-3 px-6 py-5">
                <div className="flex flex-col gap-2">
                  <span className={statLabel}>Submitted</span>
                  <span className={statValue}>{submittedOn(last?.date ?? null) ?? '---------'}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={statLabel}>Attempts</span>
                  <span className={statValue}>Unlimited</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={statLabel}>Time</span>
                  <span className={statValue}>{time}</span>
                </div>
              </div>
            </section>

            <section aria-label="Your Marks" className="border-info-50 bg-surface rounded-[20px] border-[1.5px]">
              <h2 className={cardTitle}>Your Marks</h2>
              <div className="flex min-h-[84px] items-center justify-between gap-3 px-6 py-5">
                <p className="text-success-550 m-0 text-[28px] leading-7 font-bold">
                  {last ? last.marksObtained : '--'}/<span className="text-neutral-900">{last ? last.totalMarks : '--'}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onViewSubmissions(set)}
                  className="text-info-600 flex items-center gap-2 self-end text-[16px] leading-[22px] font-bold"
                >
                  View Submissions <ChevronRight aria-hidden className="size-4" />
                </button>
              </div>
            </section>
          </div>

          {set.sections.length > 0 && (
            <div className="relative mt-8 flex items-center">
              <button
                type="button"
                aria-label="Previous sections"
                onClick={() => setFirst((n) => Math.max(0, n - SECTIONS_PER_PAGE))}
                disabled={first === 0}
                className="bg-surface absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-full border border-neutral-300 p-2 shadow-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                <ChevronLeft aria-hidden className="size-3" />
              </button>
              <div className="mx-4 grid w-full gap-5 sm:grid-cols-2">
                {sections.map((section, index) => (
                  <section
                    key={`${section.type}-${section.marks}-${first + index}`}
                    aria-label={`Section ${first + index + 1}`}
                    className="border-info-50 bg-surface rounded-[20px] border-[1.5px]"
                  >
                    <div className="border-info-50 bg-surface flex items-center justify-between rounded-[20px] border-[1.5px] px-6 py-4">
                      <h3 className="m-0 text-[20px] leading-6 font-bold text-neutral-900 md:text-[24px]">Section {first + index + 1}</h3>
                      <span className="text-[16px] leading-4 font-semibold text-neutral-900">{section.marks} Mark</span>
                    </div>
                    <div className="flex flex-wrap gap-x-[45px] gap-y-3 px-6 py-5">
                      <div className="flex flex-col gap-2">
                        <span className={statLabel}>Questions</span>
                        <span className={statValue}>{section.count}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className={statLabel}>Type</span>
                        <span className={statValue}>{section.type}</span>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              <button
                type="button"
                aria-label="Next sections"
                onClick={() => setFirst((n) => n + SECTIONS_PER_PAGE)}
                disabled={first + SECTIONS_PER_PAGE >= set.sections.length}
                className="bg-surface absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-full border border-neutral-300 p-2 shadow-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                <ChevronRight aria-hidden className="size-3" />
              </button>
            </div>
          )}

          <div className="mt-[29px] flex justify-end">
            <Link
              href={routes.testPlayer(exam.slug, testType, set.setId)}
              className="bg-brand border-brand text-on-brand flex items-center gap-3 rounded-[14px] border-[1.5px] px-6 py-4 text-[16px] leading-4 font-semibold"
            >
              {set.inProgress ? 'Resume' : set.attempts.length > 0 ? 'Start Again' : 'Start Exam'}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** Quiz / unit test: what the test holds, Get Started, and the latest grade. */
function QuizView({ data, onViewSubmissions }: { data: Extract<CourseAssessmentOverview, { kind: 'quiz' }>; onViewSubmissions: () => void }) {
  const exam = useExam();
  const { assessment, submissions } = data;
  const latest = submissions[0];
  const type = titleCase(assessment.type);
  const improvement = improvementOf(latest, submissions);
  const card = 'border-info-50 bg-surface mb-6 flex flex-col justify-between gap-4 rounded-[18px] border-2 p-6 md:min-h-[147px]';

  return (
    <div className="flex justify-center">
      <div className="flex w-full max-w-[766px] flex-col md:pt-[57px]">
        <div className="text-left">
          <AssessmentRing className="mr-4 h-10 w-[100px] md:h-[70px] md:w-[145px]">{type}</AssessmentRing>
        </div>
        <div className="pt-3.5 md:mt-[5px]">
          <h1 className="mb-0 text-[28px] leading-none font-bold text-neutral-850 md:text-[36px]">
            {type} on {assessment.title}!
          </h1>
          {assessment.instructions ? <ReadMoreText text={assessment.instructions} /> : <div className="mb-6" />}

          <section aria-label="Assignment Details" className={card}>
            <h2 className="text-left text-[20px] font-bold text-neutral-900 md:text-[24px]">Assignment Details</h2>
            <div className="flex flex-wrap items-center justify-between gap-2 md:gap-8">
              <div className="flex flex-col">
                <span className="text-left text-[16px] leading-4 font-bold text-neutral-625 md:text-[18px] md:leading-5">Submitted</span>
                <span className="text-[13px] font-semibold text-neutral-625 md:text-[14px]">{submittedOn(latest?.date ?? null) ?? '_ _ _ _ _ _'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-left text-[18px] leading-5 font-bold text-neutral-625">Attempts</span>
                <span className="text-[14px] font-semibold text-neutral-625">Unlimited</span>
              </div>
              <div className="flex flex-col">
                <span className="text-left text-[18px] leading-5 font-bold text-neutral-625">Questions</span>
                <span className="text-[14px] font-semibold text-neutral-625">{data.totalQuestions}</span>
              </div>
              <Link
                href={routes.testPlayer(exam.slug, data.testType, assessment.id)}
                className="bg-brand border-info-700 text-on-brand flex items-center justify-center rounded-[8px] border px-2 py-1.5 text-[16px] font-semibold md:h-12 md:w-[149px] md:px-3.5"
              >
                {data.inProgress ? 'Continue' : 'Get Started'}
                <ChevronRight aria-hidden className="ml-2 size-4" />
              </Link>
            </div>
          </section>

          <section aria-label="Your Grade" className={card}>
            <h2 className="text-left text-[20px] leading-6 font-bold text-neutral-850 md:text-[24px]">Your Grade</h2>
            <p className="text-success-550 text-[20px] font-bold md:text-[28px]">{latest ? `${latest.marksObtained} Marks` : '_ _ _ _ _'}</p>
            <div className="flex w-full flex-col justify-between gap-2 md:flex-row">
              <p className="w-fit py-0 text-[12px] leading-[15px] font-medium text-neutral-475">
                {!latest ? (
                  '_ _ _ _ _ _'
                ) : improvement === null ? (
                  'This is your first submission'
                ) : (
                  <>
                    Your performance in your latest test is <span className="font-bold">{Math.abs(improvement).toFixed(1)}%</span>{' '}
                    {improvement > 0 ? 'better' : 'lower'} than the previous test.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={onViewSubmissions}
                className="text-brand w-full text-left text-[16px] leading-5 font-semibold underline md:w-fit"
              >
                View Submissions
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** /[exam]/learn/[courseId]/assessments/[assessmentType]/[assessmentId] (board). */
export function CourseAssessmentScreen({ courseId, assessmentId }: { courseId: string; assessmentId: string }) {
  const exam = useExam();
  const router = useRouter();
  const overview = useQuery({
    queryKey: learnKeys.courseAssessment(exam.slug, assessmentId),
    queryFn: () => learnApi.courseAssessment(exam, assessmentId),
  });
  const data = overview.data;
  const course = data?.assessment.courseId || courseId;
  const outline = useCourseOutline(course);
  const [drawer, setDrawer] = useState<{ open: boolean; attempts: CourseAttempt[]; subtitle?: string }>({ open: false, attempts: [] });

  if (overview.isError) {
    return (
      <div className="mt-5 px-2">
        <SectionError title="Failed To Fetch Assessment" error={overview.error} />
      </div>
    );
  }

  const assessment = data?.assessment;
  const type = assessment?.type ?? '';
  const isQuiz = data?.kind === 'quiz';
  const chapters = outline.data?.chapters ?? [];
  // Quiz / unit test crumbs show their chapter (previous app's ?module_id=); mid-term / final sit at course level.
  const moduleId = isQuiz ? (assessment?.moduleId ?? null) : null;
  const chapterIndex = moduleId ? chapters.findIndex((c) => c.id === moduleId) : -1;
  const chapterHref = moduleId ? routes.boardModule(exam.slug, course, moduleId, type === 'unit_test' ? 'practice' : 'learn') : null;
  const currentLabel = isQuiz ? `${titleCase(type)}: ${formatTitle(assessment?.title)}` : titleCase(type) || 'Assessment';

  const go = (activity: Activity | null | undefined) => {
    if (activity) router.push(activityHref(exam.slug, course, activity));
  };
  const previous = data?.previous ?? null;
  const next = data?.next ?? null;
  const navButton = 'text-brand flex items-center gap-1 text-[14px] leading-[14px] font-medium disabled:opacity-50';
  const mobileButton =
    'text-brand flex items-center rounded-[6px] border-[1.5px] border-line px-5 py-2 text-[14px] leading-[14px] font-medium disabled:opacity-50';

  return (
    <div className="flex flex-col pb-[90px] md:mt-4">
      <nav aria-label="Assessment navigation" className="flex items-center justify-between gap-3 px-2">
        <Breadcrumb
          backHref={chapterHref ?? routes.learnCourse(exam.slug, course)}
          crumbs={[
            { label: 'Learn', href: routes.learn(exam.slug) },
            ...(outline.data?.course ? [{ label: titleCase(outline.data.course.subjectName) }] : []),
            ...(chapterIndex >= 0 && chapterHref ? [{ label: `Ch ${chapterIndex + 1}: ${formatTitle(chapters[chapterIndex]!.title)}`, href: chapterHref }] : []),
            { label: data ? currentLabel : 'Assessment' },
          ]}
        />
        <div className="hidden shrink-0 gap-6 md:flex">
          <button type="button" onClick={() => go(previous)} disabled={!previous} className={navButton}>
            <ChevronLeft aria-hidden className="size-3.5" />
            Previous
          </button>
          <button type="button" onClick={() => go(next)} disabled={!next} className={navButton}>
            Next
            <ChevronRight aria-hidden className="size-3.5" />
          </button>
        </div>
      </nav>

      <div className="mt-6 px-2">
        {!data ? (
          <div aria-busy="true" aria-label="Loading assessment" className="mx-auto flex w-full max-w-[846px] flex-col gap-5">
            <Skeleton className="h-[138px] w-full rounded-[20px]" />
            <Skeleton className="h-[338px] w-full rounded-[20px]" />
          </div>
        ) : data.kind === 'sets' ? (
          <SetsView
            data={data}
            onViewSubmissions={(set) => setDrawer({ open: true, attempts: set.attempts, subtitle: `Set ${set.setNumber}` })}
          />
        ) : (
          <QuizView data={data} onViewSubmissions={() => setDrawer({ open: true, attempts: data.submissions })} />
        )}
      </div>

      {data && (
        <AttemptsDrawer
          open={drawer.open}
          onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
          subtitle={drawer.subtitle ? `${drawer.subtitle} · ${drawer.attempts.length} ${drawer.attempts.length === 1 ? 'attempt' : 'attempts'}` : undefined}
          attempts={drawer.attempts.map(toChapterAttempt)}
          emptyMessage="Your score and answers will show up here once you finish a test."
          reviewHref={(attemptId) => routes.testResult(exam.slug, data.testType, attemptId)}
        />
      )}

      <div className="bg-surface border-line fixed right-0 bottom-0 z-20 flex h-[50px] w-full items-center justify-between border-t-2 px-6 md:hidden">
        <button type="button" onClick={() => go(previous)} disabled={!previous} className={mobileButton}>
          <ChevronLeft aria-hidden className="size-3" />
          Previous
        </button>
        <button type="button" onClick={() => go(next)} disabled={!next} className={mobileButton}>
          Next
          <ChevronRight aria-hidden className="size-3" />
        </button>
      </div>
    </div>
  );
}
