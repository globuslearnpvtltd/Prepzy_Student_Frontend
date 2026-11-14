'use client';

import { cx, Dialog, DialogContent, DialogDescription, DialogTitle, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { SubjectCardGrid } from '@/shared/ui/subject-card';
import { routes } from '@/shared/config/routes';
import { activityHref, learnApi, titleCase, type LearnSubject } from '../api';
import { learnKeys, useLearnContext, useSubjectCourses, useSubjects } from '../hooks';
import { FreeCourses } from './free-courses';
import { CoverImage, DidYouKnow, ProgressBar, SectionError } from './kit';

const card = 'border-neutral-200 bg-surface rounded-xl border-2 p-6';

/* ------------------------------ Continue learning ------------------------------ */

/** Courses in progress; each card resumes at the student's next lecture or test. */
export function ContinueLearning() {
  const { exam, classId } = useLearnContext();
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({
    queryKey: learnKeys.continue(classId),
    queryFn: () => learnApi.continueCourses(exam, classId!),
    enabled: classId !== null,
  });
  if (query.isError) return <SectionError title="Failed to fetch Continue Learning" error={query.error} />;
  const courses = query.data ?? [];
  if (courses.length === 0) return null;
  return (
    <section aria-labelledby="continue-learning" className={card}>
      <div className="flex items-center justify-between">
        <h2 id="continue-learning" className="text-[16px] leading-5 font-semibold text-neutral-800">
          Continue Learning
        </h2>
        {courses.length > 0 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-brand hidden text-[14px] font-medium md:block">
            {showAll ? 'Show Less' : 'View All'}
          </button>
        )}
      </div>
      <ul className="mt-5 flex gap-6 overflow-x-auto pb-2.5 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {courses.map((course, index) => (
          <li key={course.courseId} className={cx('min-w-[280px] md:min-w-0', index >= 3 && !showAll && 'md:hidden')}>
            <Link
              href={course.next ? activityHref(exam.slug, course.courseId, course.next) : routes.learnCourse(exam.slug, course.courseId)}
              className="border-line bg-canvas flex h-full flex-col gap-4 rounded-lg border-2 p-2.5"
            >
              <span className="border-line relative block h-[93px] overflow-hidden rounded-[14px] border md:h-[113px]">
                <CoverImage src={course.image} alt="" />
              </span>
              <span className="mb-3.5 flex flex-col gap-1.5 px-2.5 md:gap-3">
                <span className="flex gap-2.5">
                  <span className="border-brand-150 bg-brand-75 text-brand rounded-[10px] border px-3 py-2 text-[8px] leading-2 font-medium md:text-[12px] md:leading-3">
                    {titleCase(course.className)}
                  </span>
                  <span className="border-accent-500 bg-accent-400 text-on-brand rounded-[10px] border-2 px-3 py-2 text-[8px] leading-2 font-semibold md:text-[11px] md:leading-3">
                    {titleCase(course.subjectName)}
                  </span>
                </span>
                <span className="text-neutral-850 hover:text-info text-[16px] leading-6 font-semibold">{course.name}</span>
                <ProgressBar percent={course.percent} label={`${course.name} progress`} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Course listing modal ------------------------------ */

const DEFAULT_SUBJECT_COPY = 'Learn tricky chapters like polynomials, triangles, and probability the smart way.';

/** A subject's books (courses), opened from a subject card. */
export function CourseListingModal({ subject, onClose }: { subject: LearnSubject | null; onClose: () => void }) {
  const { exam, classId } = useLearnContext();
  const courses = useSubjectCourses(classId, subject?.id ?? null);
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const list = courses.data ?? [];
  const className = list[0]?.className || 'CLASS';
  const loading = courses.isPending && !!subject;
  const chip = 'rounded-[12px] border-2 px-4 py-3 text-[12px] leading-[8.5px] font-semibold';
  const meta = (dark: boolean) => (
    <>
      <span className="flex items-center gap-2">
        <span className={cx(chip, dark ? 'bg-surface border-info-50 text-brand' : 'bg-info-50/40 border-info-50 text-brand')}>
          {className}
        </span>
        <span className={cx(chip, 'bg-brand border-brand-800 text-on-brand')}>{list.length} Books</span>
      </span>
      <DialogTitle className={cx('pt-3.5 text-[22px] leading-[22px] font-bold', dark ? 'text-on-brand' : 'text-neutral-900')}>
        {subject?.name || 'Subject'}
      </DialogTitle>
      <DialogDescription className={cx('pt-2 text-[12px] leading-4 font-normal', dark ? 'text-on-brand' : 'text-neutral-900')}>
        {subject?.description || DEFAULT_SUBJECT_COPY}
      </DialogDescription>
    </>
  );
  return (
    <Dialog open={subject !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-32px)] max-w-[595px] gap-0 overflow-hidden rounded-xl p-0">
        <div className="max-h-[calc(100dvh-64px)] overflow-y-auto p-4 md:p-[22.5px]">
          <div className="bg-learn-soft relative h-[186px] w-full overflow-hidden rounded-xl md:h-[294px]">
            {subject?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={subject.image}
                alt=""
                onLoad={() => setBannerLoaded(true)}
                onError={() => setBannerLoaded(true)}
                className={cx('h-full w-full object-cover transition-opacity duration-500', bannerLoaded ? 'opacity-100' : 'opacity-0')}
              />
            )}
            {!loading && (
              <div className="to-neutral-900 absolute inset-0 hidden flex-col justify-end bg-linear-to-b from-transparent from-[26%] p-6 pb-7 md:flex">
                {meta(true)}
              </div>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="text-on-brand absolute top-4 right-4 z-10">
              <X aria-hidden className="size-6" />
            </button>
          </div>
          {!loading && <div className="mt-6 flex flex-col md:hidden">{meta(false)}</div>}
          <div className="mt-7">
            <h3 className="text-[14px] leading-[14px] font-semibold text-neutral-900 md:text-[16px]">Books</h3>
            <hr className="border-neutral-100 mt-[9px] border-[1.5px]" />
            {!loading && (courses.isError || list.length === 0) ? (
              <div className="border-info-50 bg-learn-hover mt-5 flex w-full flex-col items-center gap-1.5 rounded-xl border-2 px-5 py-7 text-center">
                <span className="text-learn-ink text-[15px] leading-[22px] font-semibold">
                  {courses.isError ? "Couldn't load the books" : 'No books available yet'}
                </span>
                <span className="text-learn-muted max-w-[320px] text-[12px] leading-[18px]">
                  {courses.isError
                    ? 'Something went wrong. Please check your connection and try again.'
                    : `Books for ${subject?.name || 'this subject'} will show up here soon.`}
                </span>
                <span className="mt-3 flex items-center gap-2.5">
                  {courses.isError && (
                    <button
                      type="button"
                      onClick={() => void courses.refetch()}
                      className="bg-brand hover:bg-brand-deep text-on-brand rounded-full px-[18px] py-2 text-[12px] leading-[18px] font-semibold"
                    >
                      Try again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-brand-75 text-brand rounded-full px-[18px] py-2 text-[12px] leading-[18px] font-semibold"
                  >
                    Go back
                  </button>
                </span>
              </div>
            ) : (
              <ul className="mt-5 grid grid-cols-1 gap-[17px] md:grid-cols-3">
                {loading
                  ? [0, 1, 2].map((i) => (
                      <li key={i} aria-hidden className="border-info-50 bg-surface rounded-xl border-2 p-2">
                        <Skeleton className="h-[80px] w-full rounded-[14px]" />
                        <Skeleton className="mt-3 h-4 w-3/4" />
                      </li>
                    ))
                  : list.map((course) => (
                      <li key={course.courseId}>
                        <Link
                          href={routes.learnCourse(exam.slug, course.courseId)}
                          className="border-info-50 bg-surface grid h-[124px] grid-cols-12 rounded-xl border-2 p-2 md:h-full md:grid-cols-1 md:grid-rows-[80px_1fr]"
                        >
                          <span className="col-span-6 block h-[108px] overflow-hidden rounded-[14px] md:h-[80px]">
                            <CoverImage src={course.image} alt="" className="rounded-[14px]" />
                          </span>
                          <span className="col-span-6 flex flex-col items-start justify-center gap-3.5 pl-[18px] md:justify-start md:pt-3 md:pl-[7px]">
                            <span className="text-neutral-850 text-[14px] leading-[18px] font-semibold">{course.title}</span>
                            <span className="line-clamp-1 text-[10px] leading-[10px] font-medium text-neutral-450">
                              {course.lectureCount} Lessons-{course.testCount} Tests
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- My subjects ---------------------------------- */

/** Subject cards; a card opens its books in the course listing modal. */
export function SubjectListing() {
  const { classId, isPending } = useLearnContext();
  const subjects = useSubjects(classId);
  const [selected, setSelected] = useState<LearnSubject | null>(null);
  // Without a plan the student gets the free courses instead (previous app's SubjectListing).
  if (classId === null) return isPending ? null : <FreeCourses />;
  return (
    <section aria-labelledby="my-subjects" className="flex flex-col gap-2.5">
      <h2 id="my-subjects" className="text-neutral-850 text-[18px] leading-[18px] font-semibold md:text-[24px] md:leading-6">
        My Subjects
      </h2>
      {subjects.isPending ? (
        <div aria-busy="true" aria-label="Loading" className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
          ))}
        </div>
      ) : subjects.isError ? (
        <SectionError title="Failed to fetch subjects" error={subjects.error} />
      ) : subjects.data.length === 0 ? (
        <p className="text-foreground-muted text-sm">No Subjects Available</p>
      ) : (
        <SubjectCardGrid
          className="mt-3"
          collapse
          items={subjects.data.map((subject) => ({
            key: subject.id,
            title: titleCase(subject.name),
            subject: subject.name,
            meta: `${subject.courseCount} Books`,
            onClick: () => setSelected(subject),
          }))}
        />
      )}
      <CourseListingModal subject={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

/* ---------------------------------- Page layout ---------------------------------- */

/** Two-column page shell shared by Learn and Notes: main column (70%) + aside (30%). */
export function TwoColumn({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 md:flex-row">
      <div className="flex w-full min-w-0 flex-col gap-[30px] md:w-[70%] md:gap-10">
        <h1 className="md:text-brand text-[28px] leading-7 font-bold text-neutral-950 md:text-[64px] md:leading-16">{title}</h1>
        {children}
      </div>
      {aside && <div className="mt-10 flex w-full min-w-0 flex-col gap-5 md:mt-0 md:w-[30%]">{aside}</div>}
    </div>
  );
}

/** /[exam]/learn: continue learning, subjects (→ books), a fun fact; the aside comes from the page. */
export function LearnScreen({ aside }: { aside?: ReactNode }) {
  return (
    <TwoColumn title="Learn" aside={aside}>
      <ContinueLearning />
      <SubjectListing />
      <DidYouKnow />
    </TwoColumn>
  );
}
