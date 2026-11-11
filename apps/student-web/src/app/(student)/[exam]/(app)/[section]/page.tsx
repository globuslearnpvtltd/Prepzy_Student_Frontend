import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getExam } from '@/shared/config/exams';
import { placeholderSections, sectionTitle } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { SectionPlaceholder } from '@/shared/layout/section-placeholder';

export function generateStaticParams({ params }: { params: { exam: string } }) {
  const exam = getExam(params.exam);
  return exam ? placeholderSections(exam.category).map((section) => ({ section })) : [];
}

export const dynamicParams = false;

type Params = Promise<{ exam: string; section: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { exam, section } = await params;
  const config = getExam(exam);
  return { title: (config && sectionTitle(config, section)) ?? 'Prepzy' };
}

/** Existing new-app pages that already cover part of a section. */
const CURRENT_VERSION: Record<string, (exam: string) => string> = {
  'mock-tests': (exam) => routes.testList(exam, 'mock'),
  'pyq-library': (exam) => routes.testList(exam, 'pyq'),
  assessments: (exam) => routes.tests(exam),
};

export default async function SectionPage({ params }: { params: Params }) {
  const { exam, section } = await params;
  const config = getExam(exam);
  const title = config && sectionTitle(config, section);
  if (!config || !title) notFound();
  const current = CURRENT_VERSION[section];
  return (
    <SectionPlaceholder
      title={title}
      action={current ? { label: 'Open available tests', href: current(config.slug) } : undefined}
    />
  );
}
