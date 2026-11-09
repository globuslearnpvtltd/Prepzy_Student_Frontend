import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { CustomTests } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'Custom Tests' };

export default async function CustomTestPage({ params }: { params: Promise<{ exam: string }> }) {
  examForCategory((await params).exam, 'competitive');
  return <CustomTests />;
}
