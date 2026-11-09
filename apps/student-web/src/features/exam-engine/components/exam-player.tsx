'use client';

import { Button } from '@prepzy/design-system';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { PageSpinner, StatusScreen } from '@/shared/layout/status-screens';
import { isApiError, userMessage } from '@/shared/lib/errors';
import type { TestAdapter } from '../adapters';
import { countStatuses } from '../attempt';
import { useAdapter, useCountdown, useExamAttempt, useExamSession, useTestContext } from '../hooks';
import { AlreadySubmittedError, type ExamQuestion, type ExamSession, type SubmitSummary, type TestContext } from '../model';
import { testHome } from '../test-links';
import { BoardPlayer } from './player-board';
import { CompetitivePlayer } from './player-competitive';
import { CompletedDialog, SubmitDialog, SubmittingScreen } from './submit-flow';

/** Test player for every exam and test type; the layout follows the exam category. */
export function ExamPlayer({ testType, setId }: { testType: TestTypeKey; setId: string }) {
  const exam = useExam();
  const router = useRouter();
  const adapter = useAdapter(testType);
  const { context, isPending: contextPending, error: contextError } = useTestContext();
  const session = useExamSession(testType, setId, context);
  const home = testHome(exam, testType);

  useEffect(() => {
    if (session.error instanceof AlreadySubmittedError) {
      router.replace(routes.testResult(exam.slug, testType, session.error.attemptId));
    }
  }, [session.error, exam.slug, testType, router]);

  const back = (
    <Button asChild intent="outline">
      <Link href={home.href}>Back to {home.label}</Link>
    </Button>
  );

  if (!adapter) return <StatusScreen title="This test isn't available" action={back} />;
  if (contextPending || (context && session.isPending)) return <PageSpinner label="Preparing your test" />;
  if (contextError)
    return <StatusScreen title="We couldn't load your plan" description={userMessage(contextError)} action={back} />;
  if (!context)
    return <StatusScreen title="No active plan" description="You need an active plan to take this test." action={back} />;
  if (session.error instanceof AlreadySubmittedError) return <PageSpinner label="Opening your result" />;
  if (session.isError) {
    const limited = isApiError(session.error) && session.error.isRateLimited;
    return (
      <StatusScreen
        title={limited ? 'Test limit reached' : "We couldn't start this test"}
        description={userMessage(session.error)}
        action={back}
      />
    );
  }
  if (!session.data || session.data.questions.length === 0) {
    return (
      <StatusScreen title="No questions yet" description="This paper has no questions. Please try another one." action={back} />
    );
  }

  return <PlayerScreen session={session.data} adapter={adapter} context={context} testType={testType} />;
}

export type PlayerAttempt = ReturnType<typeof useExamAttempt>;

/** What each layout gets: attempt state, timer, counts and the actions shared by both. */
export interface PlayerLayoutProps {
  session: ExamSession;
  attempt: PlayerAttempt;
  /** The question on screen (always defined, unlike attempt.question). */
  question: ExamQuestion;
  secondsLeft: number | null;
  counts: ReturnType<typeof countStatuses>;
  home: { label: string; href: string };
  onSubmit: () => void;
  onExit: () => void;
  /** Save & Next: next question, or the submit dialog on the last one. */
  onNext: () => void;
}

function PlayerScreen({
  session,
  adapter,
  context,
  testType,
}: {
  session: ExamSession;
  adapter: TestAdapter;
  context: TestContext;
  testType: TestTypeKey;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState<{ attemptId: string; summary: SubmitSummary } | null>(null);
  const resultHref = (attemptId: string) => routes.testResult(context.exam.slug, testType, attemptId);
  const attempt = useExamAttempt(session, adapter, context, ({ attemptId, summary }) => {
    setConfirmOpen(false);
    if (summary && summary.obtained !== null) setCompleted({ attemptId, summary });
    else router.replace(resultHref(attemptId));
  });
  const secondsLeft = useCountdown(session.deadline, () => {
    toast.info("Time's up — submitting your answers.");
    attempt.submit.mutate();
  });
  const counts = countStatuses(session.questions, attempt.snapshot);
  const hasWritten = session.questions.some((q) => q.kind !== 'mcq');
  const home = testHome(context.exam, testType);

  if (!attempt.question) return null;

  const layout: PlayerLayoutProps = {
    session,
    attempt,
    question: attempt.question,
    secondsLeft,
    counts,
    home,
    onSubmit: () => setConfirmOpen(true),
    onExit: () => {
      attempt.saveNow();
      router.push(home.href);
    },
    onNext: () => (attempt.index === attempt.total - 1 ? setConfirmOpen(true) : attempt.goTo(attempt.index + 1)),
  };

  return (
    <>
      {context.exam.category === 'board' ? <BoardPlayer {...layout} /> : <CompetitivePlayer {...layout} />}
      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        counts={counts}
        total={attempt.total}
        hasWritten={hasWritten}
        pending={attempt.submit.isPending}
        error={attempt.submit.error}
        onSubmit={() => attempt.submit.mutate()}
      />
      {attempt.submit.isPending && <SubmittingScreen written={hasWritten} />}
      {completed && (
        <CompletedDialog
          summary={completed.summary}
          action={
            <Button size="lg" onClick={() => router.replace(resultHref(completed.attemptId))}>
              View result
            </Button>
          }
        />
      )}
    </>
  );
}
