import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveTestType, TEST_TYPES } from '@/features/exam-engine';
import { TestSets } from '@/features/exam-engine/ui';

type Params = Promise<{ exam: string; testType: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { exam, testType } = await params;
  const type = resolveTestType(exam, testType);
  return { title: type ? TEST_TYPES[type].label : 'Tests' };
}

export default async function TestListPage({ params }: { params: Params }) {
  const { exam, testType } = await params;
  const type = resolveTestType(exam, testType);
  if (!type) notFound();
  return <TestSets testType={type} />;
}
