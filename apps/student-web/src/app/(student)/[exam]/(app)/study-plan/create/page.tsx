import type { Metadata } from 'next';
import { CreatePlanScreen } from '@/features/study-plan/ui';

export const metadata: Metadata = { title: 'Create your study plan' };

export default function StudyPlanCreatePage() {
  return <CreatePlanScreen />;
}
