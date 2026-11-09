import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { CustomTestCreate } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'Create a custom test' };

export default async function CustomTestCreatePage({ params }: { params: Promise<{ exam: string }> }) {
  examForCategory((await params).exam, 'competitive');
  return <CustomTestCreate />;
}
