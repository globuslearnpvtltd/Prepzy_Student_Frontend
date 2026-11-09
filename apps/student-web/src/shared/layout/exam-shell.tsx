'use client';

import { cx } from '@prepzy/design-system';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo } from 'react';
import { AtlasHost } from '@/features/assistant/ui';
import { rememberExam, usePurchasedExams } from '@/features/auth';
import { findExam, getExam, REFERENCE, type ExamConfig } from '@/shared/config/exams';
import { competitiveChrome } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { ExamProvider, useExam } from '@/shared/hooks/use-exam';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { userMessage } from '@/shared/lib/errors';
import { AppHeader } from './app-header';
import { BoardBottomBar, BoardSidebar } from './board-navigation';
import { CompetitiveSidebar } from './competitive-navigation';
import { PageSpinner, StatusScreen } from './status-screens';

/** Wraps every /[exam]/… page: exam context, the exam's theme and the access check. */
export function ExamFrame({ examSlug, children }: { examSlug: string; children: React.ReactNode }) {
  const config = getExam(examSlug) as ExamConfig;
  const catalog = useExamCatalog();

  useEffect(() => rememberExam(config.slug), [config.slug]);

  // The exam id used for API calls comes from the backend (exam_table), matched by exam_slice and category.
  const fromBackend = catalog.data?.find((e) => e.examSlice === config.examSlice && e.category === config.category);
  const exam = useMemo(
    () => (fromBackend ? { ...config, examId: fromBackend.examId } : config),
    [config, fromBackend],
  );

  let content: React.ReactNode;
  if (catalog.isPending) content = <PageSpinner />;
  else if (catalog.isError) {
    content = <StatusScreen title="We couldn't load your exams" description={userMessage(catalog.error)} />;
  } else if (!fromBackend) {
    content = <StatusScreen title={`${config.label} isn't available right now`} description="Please try again later." />;
  } else content = <AccessGate exam={exam}>{children}</AccessGate>;

  return (
    <ExamProvider value={exam}>
      <div data-theme={exam.theme} className="bg-canvas min-h-dvh">
        {content}
      </div>
    </ExamProvider>
  );
}

/**
 * Header + navigation for regular pages, per exam category (tests run full-screen without it).
 * - board: labelled 240px sidebar, mobile bottom bar with the raised "Ask" button
 * - competitive: icon rail that expands on hover, mobile drawer from the header's menu button
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  const pathname = usePathname();
  if (exam.category === 'competitive') {
    const chrome = competitiveChrome(pathname ?? '');
    return (
      <div className="bg-canvas min-h-dvh">
        <AppHeader exam={exam} category={exam.category} />
        <div className="flex">
          <CompetitiveSidebar exam={exam} rail={chrome.rail} />
          <main id="main" className={cx('bg-canvas min-w-0 flex-1', chrome.padded && 'p-2.5 lg:p-10')}>
            {children}
          </main>
        </div>
        <Suspense fallback={null}>
          <AtlasHost />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="bg-surface min-h-dvh">
      <AppHeader exam={exam} category={exam.category} />
      <BoardSidebar exam={exam} />
      <div className="mx-auto w-full max-w-[1440px] pb-[90px] md:pb-[60px]">
        <main id="main" className="m-5 max-w-[1220px] md:ml-[240px]">
          {children}
        </main>
      </div>
      <BoardBottomBar exam={exam} />
      <Suspense fallback={null}>
        <AtlasHost />
      </Suspense>
    </div>
  );
}

/** Shell for pages outside any exam (reference books): header only, reference theme. */
export function ReferenceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme={REFERENCE.theme} className="bg-canvas min-h-dvh">
      <AppHeader exam={null} category={REFERENCE.category} />
      <main id="main" className="mx-auto w-full max-w-[1220px] px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}

function AccessGate({ exam, children }: { exam: ExamConfig; children: React.ReactNode }) {
  const router = useRouter();
  const purchased = usePurchasedExams();
  const owned = purchased.data?.some((p) => p.examSlice === exam.examSlice);
  const fallback = purchased.data?.map((p) => findExam(p.examSlice)).find((e): e is ExamConfig => !!e);

  // Students who land on an exam they don't have (old bookmark, default redirect) go to one they do have.
  useEffect(() => {
    if (purchased.isSuccess && !owned && fallback) router.replace(routes.dashboard(fallback.slug));
  }, [purchased.isSuccess, owned, fallback, router]);

  if (purchased.isPending) return <PageSpinner />;
  if (purchased.isError) {
    return <StatusScreen title="We couldn't load your account" description={userMessage(purchased.error)} />;
  }
  if (!owned) {
    return fallback ? (
      <PageSpinner label="Opening your exam" />
    ) : (
      <StatusScreen
        title={`${exam.label} isn't on your account`}
        description="Choose a plan for this exam to start learning."
      />
    );
  }
  return children;
}
