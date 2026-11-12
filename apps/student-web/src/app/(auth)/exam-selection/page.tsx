import type { Metadata } from 'next';
import { ExamPicker } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Choose your exam' };

export default function ExamSelectionPage() {
  return <ExamPicker />;
}
