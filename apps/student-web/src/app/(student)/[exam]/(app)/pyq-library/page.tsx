import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { TestLibrary } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'PYQ Library' };

export default async function PyqLibraryPage({ params }: { params: Promise<{ exam: string }> }) {
  examForCategory((await params).exam, 'competitive');
  return <TestLibrary kind="pyq" />;
}
