import type { Metadata } from 'next';
import { SchoolsStudentDetail } from '@/features/schools/ui';

export const metadata: Metadata = { title: 'Student' };

export default async function SchoolsStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ class_id?: string | string[] }>;
}) {
  const { studentId } = await params;
  const { class_id: classId } = await searchParams;
  return <SchoolsStudentDetail studentId={studentId} classId={Array.isArray(classId) ? classId[0] : classId} />;
}
