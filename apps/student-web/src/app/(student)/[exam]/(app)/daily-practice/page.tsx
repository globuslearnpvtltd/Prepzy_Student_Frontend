import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { DailyPractice } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'Daily Practice' };

export default async function DailyPracticePage({ params }: { params: Promise<{ exam: string }> }) {
  examForCategory((await params).exam, 'competitive');
  return <DailyPractice />;
}
