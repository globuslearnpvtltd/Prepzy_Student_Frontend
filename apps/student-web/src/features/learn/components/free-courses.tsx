'use client';

import { Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { learnApi } from '../api';
import { learnKeys } from '../hooks';
import { SectionError } from './kit';

const PLACEHOLDER = '/illustrations/dashboard/free-course.jpg';

/** "My Free Courses": what a board student without a plan sees in place of "My Subjects" (dashboard and Learn). */
export function FreeCourses() {
  const exam = useExam();
  const courses = useQuery({ queryKey: learnKeys.freeCourses(exam.slug), queryFn: learnApi.freeCourses });
  return (
    <section aria-labelledby="free-courses" className="flex flex-col gap-2.5">
      <h2 id="free-courses" className="text-neutral-850 text-[18px] leading-[18px] font-semibold md:text-[24px] md:leading-6">
        My Free Courses
      </h2>
      {courses.isPending ? (
        <div aria-busy="true" aria-label="Loading" className="mt-3 flex gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[250px] min-w-[70%] rounded-[20px] md:min-w-[32%]" />
          ))}
        </div>
      ) : courses.isError ? (
        <SectionError title="Failed To Fetch Subject Data" error={courses.error} />
      ) : courses.data.length === 0 ? (
        <p className="text-foreground-muted mt-3 text-sm">No Free Courses Available</p>
      ) : (
        <ul className="mt-3 flex w-full gap-3 overflow-x-auto">
          {courses.data.map((course) => (
            <li key={course.id} className="max-w-[70%] min-w-[70%] md:max-w-[32%] md:min-w-[32%]">
              <Link
                href={routes.learnCourse(exam.slug, course.id)}
                className="border-info-soft bg-surface flex h-full flex-col gap-2.5 rounded-[20px] border-2 p-2.5 transition-shadow hover:shadow-lg"
              >
                <span className="relative block h-[93px] w-full overflow-hidden rounded-[14px] md:h-[113px]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote course art from the CMS */}
                  <img
                    src={course.image ?? PLACEHOLDER}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                      if (!e.currentTarget.src.endsWith(PLACEHOLDER)) e.currentTarget.src = PLACEHOLDER;
                    }}
                  />
                </span>
                <span className="mb-2.5 flex grow flex-col justify-between px-2.5">
                  <span className="mb-5 flex flex-col gap-1.5 md:gap-3">
                    <span className="flex gap-2">
                      <span className="border-brand-150 bg-brand-75 text-brand rounded-[10px] border px-3 py-2 text-[8px] leading-2 font-medium md:text-[11px] md:leading-3">
                        {course.className}
                      </span>
                      <span className="border-accent-400 bg-accent-400 text-on-brand rounded-[10px] border-2 px-3 py-2 text-[8px] leading-2 font-semibold md:text-[11px] md:leading-3">
                        {course.subject}
                      </span>
                    </span>
                    <span className="text-neutral-850 text-[16px] leading-5 font-bold md:text-[20px] md:leading-[26px]">{course.title}</span>
                  </span>
                  <span className="text-neutral-450 text-xs font-medium md:text-[13px] md:leading-3">
                    {course.lessons} Lessons - {course.tests} Tests
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
