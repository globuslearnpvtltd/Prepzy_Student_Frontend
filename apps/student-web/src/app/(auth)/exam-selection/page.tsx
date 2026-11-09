import type { Metadata } from 'next';
import { AuthScreen, ExamPicker } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Choose your exam' };

export default function ExamSelectionPage() {
  return (
    <AuthScreen
      eyebrow="Your exam"
      title="What are you preparing for?"
      subtitle="You can add more exams later."
      step={[3, 5]}
    >
      <ExamPicker />
    </AuthScreen>
  );
}
