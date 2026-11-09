import type { Metadata } from 'next';
import { SchoolsDashboard } from '@/features/schools/ui';

export const metadata: Metadata = { title: 'Dashboard' };

export default function SchoolsDashboardPage() {
  return <SchoolsDashboard />;
}
