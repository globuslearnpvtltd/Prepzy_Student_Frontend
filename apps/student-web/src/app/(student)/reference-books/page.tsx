import type { Metadata } from 'next';
import { ReferenceBooksComingSoon } from '@/features/reference-books/ui';

export const metadata: Metadata = { title: 'Reference Books' };

export default function ReferenceBooksPage() {
  return <ReferenceBooksComingSoon />;
}
