import type { Metadata } from 'next';
import { StudyPlanScreen } from '@/features/study-plan/ui';

export const metadata: Metadata = { title: 'Study Plan' };

export default function StudyPlanPage() {
  return <StudyPlanScreen />;
}
