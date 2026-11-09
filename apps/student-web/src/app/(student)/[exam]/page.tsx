import { redirect } from 'next/navigation';
import { routes } from '@/shared/config/routes';

export default async function ExamIndex({ params }: { params: Promise<{ exam: string }> }) {
  const { exam } = await params;
  redirect(routes.dashboard(exam));
}
