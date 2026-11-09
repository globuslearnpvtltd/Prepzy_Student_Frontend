import type { Metadata } from 'next';
import { ChaptersScreen } from '@/features/study-plan/ui';

export const metadata: Metadata = { title: 'Choose chapters' };

export default function StudyPlanChaptersPage() {
  return <ChaptersScreen />;
}
