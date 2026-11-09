import type { Metadata } from 'next';
import { TestHub } from '@/features/exam-engine/ui';

export const metadata: Metadata = { title: 'Tests' };

export default function TestsPage() {
  return <TestHub />;
}
