'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Captions, Check, ChevronDown, ChevronLeft, FileText, Gauge, PlayCircle, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { learnApi, titleCase, type TextbookSubject } from '../api';
import { CoverImage, SectionError } from './kit';

const pill = 'min-w-fit cursor-pointer rounded-lg border-2 px-10 py-[15px] text-[16px] leading-5 font-semibold';

/** /[exam]/courses: every textbook, filtered by class and subject. */
export function CoursesScreen() {
  const exam = useExam();
  const searchParams = useSearchParams();
  const [classId, setClassId] = useState(searchParams.get('class') ?? '');
  const [subjectId, setSubjectId] = useState(searchParams.get('subject') ?? '');
  const classes = useQuery({ queryKey: ['learn', 'classes'], queryFn: learnApi.classes, staleTime: 10 * 60_000 });
  const textbooks = useQuery({ queryKey: ['learn', 'textbooks', classId], queryFn: () => learnApi.textbooks(classId) });

  const subjects: TextbookSubject[] = textbooks.data ?? [];
  const selected = subjects.find((s) => s.id === subjectId);
  const books = selected ? selected.textbooks : subjects.flatMap((s) => s.textbooks);

  const pickClass = (value: string) => {
    setClassId(value);
    setSubjectId('');
  };

  return (
    <section className="flex w-full flex-col items-center px-3 md:px-[80px] md:py-2">
      <div className="flex flex-col items-center md:px-[208px]">
        <h1 className="text-center text-[24px] leading-9 font-bold text-neutral-900 md:text-[36px]">Explore All Courses</h1>
        <p className="mt-1.5 text-center text-[12px] leading-5 font-medium text-neutral-550 md:mt-4 md:text-[16px] md:leading-[23px]">
          Explore AI-powered courses designed to make learning engaging and effective. Master subjects with interactive lessons,
          quizzes, and expert guidance—tailored for every student&apos;s success!
        </p>
      </div>

      <div role="group" aria-label="Class" className="mt-2 hidden w-full gap-6 overflow-x-auto md:flex">
        {[{ id: '', title: 'All' }, ...(classes.data ?? [])].map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            aria-pressed={classId === c.id}
            onClick={() => pickClass(c.id)}
            className={cx(pill, classId === c.id ? 'bg-brand text-on-brand border-brand/20' : 'bg-info-50/40 text-info border-info/20')}
          >
            {c.title}
          </button>
        ))}
      </div>

      {subjects.length > 0 && (
        <div role="group" aria-label="Subject" className="border-accent-500/10 bg-accent-50 mt-[62px] hidden w-full items-center gap-6 overflow-x-auto rounded-xl border-2 p-2 md:flex">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={subjectId === s.id}
              onClick={() => setSubjectId(subjectId === s.id ? '' : s.id)}
              className={cx(
                'flex h-11 max-w-[33%] items-center justify-center rounded-lg px-5 text-[16px] leading-5 font-semibold whitespace-nowrap',
                subjectId === s.id ? 'bg-warning-500 text-on-brand border-2 border-warning-500' : 'bg-surface text-warning-500 border border-warning-100',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex w-full flex-row justify-center gap-2.5 md:hidden">
        <label className="relative w-[163px]">
          <span className="sr-only">Class</span>
          <select
            value={classId}
            onChange={(event) => pickClass(event.target.value)}
            className="border-info/40 bg-info-50/40 text-info w-full appearance-none rounded-lg border-2 py-4 pr-8 pl-5 text-[16px] font-semibold"
          >
            <option value="">All Classes</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="text-info pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        </label>
        <label className="relative w-[163px]">
          <span className="sr-only">Subject</span>
          <select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            disabled={!subjects.length}
            className="border-warning-500/40 bg-accent-50 text-warning-500 w-full appearance-none rounded-lg border-2 py-4 pr-8 pl-5 text-[16px] font-semibold"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="text-warning-500 pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        </label>
      </div>

      <div className="mt-8 w-full">
        {textbooks.isError ? (
          <SectionError title="Failed to fetch courses" error={textbooks.error} />
        ) : textbooks.isPending ? (
          <div aria-busy="true" aria-label="Loading courses" className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[380px] w-full rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <p className="text-center text-[16px] text-neutral-550">No courses found for the selected class and subject.</p>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            {books.map((book) => (
              <li key={`${book.subjectName}-${book.id}`}>
                <Link
                  href={`${routes.courseDetail(exam.slug, book.id)}?class_id=${book.classId}`}
                  className="border-neutral-100 bg-surface flex h-full flex-col gap-3.5 rounded-xl border-[1.5px] pb-5 shadow-card transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  <span className="block h-[188px] overflow-hidden rounded-t-xl">
                    <CoverImage src={book.image} alt={book.name} />
                  </span>
                  <span className="flex h-full flex-col gap-2 px-5">
                    <span className="text-[12px] leading-[14px] font-medium text-neutral-900">{book.className}</span>
                    <span className="text-[20px] leading-5 font-bold text-neutral-900">
                      {book.subjectName} - {book.name}
                    </span>
                    <span className="text-[16px] leading-[22px] font-medium text-neutral-900">
                      {book.description.length > 150 ? `${book.description.slice(0, 150)}...` : book.description}
                    </span>
                  </span>
                  <span className="bg-brand text-on-brand border-info mx-5 flex justify-center rounded-[14px] border-[1.5px] py-3.5 text-[14px] leading-5 font-bold">
                    View Details
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** /[exam]/courses/[courseId]: a course's overview, outcomes and chapter outline. */
export function CourseDetailScreen({ courseId }: { courseId: string }) {
  const exam = useExam();
  const course = useQuery({ queryKey: ['learn', 'course', courseId], queryFn: () => learnApi.course(courseId) });
  const curriculum = useQuery({ queryKey: ['learn', 'curriculum', courseId], queryFn: () => learnApi.curriculum(courseId) });
  const subscribed = useQuery({ queryKey: ['learn', 'subscribed-classes'], queryFn: learnApi.subscribedClasses });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (course.isError) return <SectionError title="Failed to fetch course" error={course.error} />;
  if (course.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading course" className="mx-6 mt-5 flex flex-col gap-5 md:mx-[76px]">
        <Skeleton className="h-11 w-48 rounded-md" />
        <Skeleton className="h-[418px] w-full rounded-xl" />
      </div>
    );
  }
  const detail = course.data;
  const isSubscribed = (subscribed.data ?? []).includes(detail.classId);
  const facts = [
    { icon: Volume2, label: 'Language', value: 'English' },
    { icon: Captions, label: 'Subtitles', value: 'English' },
    { icon: FileText, label: 'Lesson Quizes', value: String(detail.quizCount) },
  ];

  return (
    <div className="mx-6 mt-5 mb-6 flex flex-col gap-5 md:mx-[76px]">
      <Link
        href={routes.courses(exam.slug)}
        className="flex w-fit items-center gap-2 rounded-[10px] bg-neutral-100 p-2.5 text-[16px] leading-[22px] font-semibold text-neutral-900 hover:bg-neutral-150"
      >
        <ChevronLeft aria-hidden className="size-6" />
        Back to Courses
      </Link>

      <div className="flex flex-col gap-5 md:flex-row">
        <div className="h-[170px] w-full overflow-hidden rounded-xl md:h-[418px] md:w-2/3">
          <CoverImage src={detail.image} alt="" />
        </div>
        <div className="bg-info-400 border-info flex h-[418px] w-full flex-col gap-6 rounded-xl border-[1.5px] p-5 md:w-1/3">
          <div className="border-info bg-info-400 flex h-16 rounded-lg border-[1.5px]">
            <div className="border-info flex w-1/2 items-center gap-[18px] border-r-[1.5px] p-5">
              <BookOpen aria-hidden className="text-on-brand size-5" />
              <span className="text-on-brand flex flex-col">
                <span className="text-[12px] leading-3 font-medium">Lessons</span>
                <span className="text-[16px] leading-4 font-semibold">{detail.lectureCount}</span>
              </span>
            </div>
            <div className="flex w-1/2 items-center gap-[18px] p-5">
              <Gauge aria-hidden className="text-on-brand size-5" />
              <span className="text-on-brand flex flex-col">
                <span className="text-[12px] leading-3 font-medium">Difficulty</span>
                <span className="text-[16px] leading-4 font-semibold">Moderate</span>
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-6 pt-10 pl-3">
            {facts.map(({ icon: Icon, label, value }) => (
              <li key={label} className="text-on-brand flex items-center gap-2.5 text-[16px] leading-4">
                <Icon aria-hidden className="size-5" />
                <span>
                  {label}: <span className="font-semibold">{value}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pl-3">
            <Link
              href={isSubscribed ? routes.learnCourse(exam.slug, detail.id) : routes.plans(exam.slug)}
              className="border-info bg-surface text-info flex h-12 items-center justify-center rounded-[14px] border-[1.5px] text-[16px] leading-[22px] font-semibold"
            >
              {isSubscribed ? 'Resume Course' : 'Enroll Now'}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <div className="w-full md:w-2/3">
          <div className="mt-8 mb-10 md:pl-3">
            <div className="flex flex-wrap gap-2.5">
              {[detail.className, detail.subjectName].filter(Boolean).map((chip) => (
                <span key={chip} className="border-info-50 bg-info-50/40 text-info flex h-9 items-center rounded-md border-[1.5px] px-3.5 text-[12px] leading-3">
                  {titleCase(chip)}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-[24px] leading-[30px] font-bold text-neutral-900 md:text-[36px] md:leading-9">{detail.title}</h1>
            <p className="mt-3 text-[16px] leading-[21px] font-medium text-neutral-900">{titleCase(detail.description)}</p>
          </div>
          {detail.outcomes.length > 0 && (
            <div className="pb-10 md:pl-3">
              <h2 className="mb-5 text-[20px] leading-5 font-bold text-neutral-900 md:text-[24px] md:leading-6">What You&apos;ll Learn?</h2>
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {detail.outcomes.map((outcome) => (
                  <li key={outcome} className="border-info-50 bg-surface flex flex-col gap-3 rounded-xl border-[1.5px] p-6">
                    <Check aria-hidden className="text-info size-5" />
                    <p className="text-[16px] leading-[21px] font-medium text-neutral-950">{outcome}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="w-full md:w-1/3">
          <div className="border-info-50 rounded-xl border-[1.5px]">
            <h2 className="border-info-50 bg-surface flex h-[68px] items-center rounded-t-xl border-b-[1.5px] px-6 text-[20px] leading-5 font-bold text-neutral-950">
              Course Content
            </h2>
            <ul className="bg-info-50/30 max-h-[540px] overflow-y-auto rounded-b-xl">
              {(curriculum.data ?? []).map((section) => (
                <li key={section.key}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === section.key ? null : section.key)}
                    aria-expanded={section.items.length ? expanded === section.key : undefined}
                    className="border-info-50 flex w-full items-center justify-between border-[1.5px] p-6 text-left text-[16px] leading-[22px] font-semibold text-neutral-900"
                  >
                    {section.title}
                    {section.items.length > 0 && <ChevronDown aria-hidden className="size-4 shrink-0" />}
                  </button>
                  {expanded === section.key &&
                    section.items.map((item, index) => (
                      <div
                        key={`${section.key}-${index}`}
                        className="border-info-50 bg-surface flex items-center justify-between border-[1.5px] p-6 text-[16px] leading-[22px] font-semibold text-neutral-900"
                      >
                        {item.label} {item.title}
                        {item.lecture && <PlayCircle aria-hidden className="text-info size-[23px] shrink-0" />}
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
