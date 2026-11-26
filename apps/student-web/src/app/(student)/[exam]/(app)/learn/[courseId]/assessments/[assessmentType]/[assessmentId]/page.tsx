import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isCourseAssessmentType } from '@/features/learn';
import { CourseAssessmentScreen } from '@/features/learn/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'Assessment' };

type Params = Promise<{ exam: string; courseId: string; assessmentType: string; assessmentId: string }>;

/**
 * /[exam]/learn/[courseId]/assessments/[assessmentType]/[assessmentId] — a board course assessment before its test:
 * mid-term / final sets, or a quiz / unit test with its submissions (previous app's learns/course/…/assessments/…).
 */
export default async function CourseAssessmentPage({ params }: { params: Params }) {
  const { exam: slug, courseId, assessmentType, assessmentId } = await params;
  if (!isCourseAssessmentType(assessmentType) || !/^\d+$/.test(assessmentId)) notFound();
  if ((await resolveExam(slug))?.category !== 'board') notFound();
  return <CourseAssessmentScreen courseId={courseId} assessmentId={assessmentId} />;
}
