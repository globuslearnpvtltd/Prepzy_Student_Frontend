'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Spinner,
} from '@prepzy/design-system';
import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { userMessage } from '@/shared/lib/errors';
import type { countStatuses } from '../attempt';
import type { SubmitSummary } from '../model';

/** "Submit your test?" with how much is answered, unanswered and marked. */
export function SubmitDialog({
  open,
  onOpenChange,
  counts,
  total,
  hasWritten,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: ReturnType<typeof countStatuses>;
  total: number;
  hasWritten: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogTitle>Submit your test?</DialogTitle>
        <DialogDescription>
          You have answered {counts.answeredTotal} of {total} questions.
          {counts.unanswered > 0 && ` ${counts.unanswered} are still unanswered.`}
          {counts.marked > 0 && ` ${counts.marked} are marked for review.`}
        </DialogDescription>
        {hasWritten && (
          <Alert tone="info">Written answers are evaluated when you submit. This can take up to a minute.</Alert>
        )}
        {!!error && (
          <Alert tone="danger">{userMessage(error, "We couldn't submit. Your answers are saved — please try again.")}</Alert>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button intent="outline" disabled={pending}>
              Keep going
            </Button>
          </DialogClose>
          <Button loading={pending} onClick={onSubmit}>
            {pending && hasWritten ? 'Evaluating…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Full-screen wait while answers are graded (previous app's PostSubmitLoading / SubmittingExamModal). */
export function SubmittingScreen({ written }: { written: boolean }) {
  return (
    <div
      role="status"
      className="bg-foreground/40 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
    >
      <div className="bg-surface flex w-full max-w-md flex-col items-center gap-4 rounded-[24px] p-8 text-center shadow-lg">
        <Spinner size="lg" label="Submitting" />
        {written ? (
          <>
            <h2 className="text-xl font-bold">
              Well Done! Your answers are <span className="text-info-700">submitted</span>
            </h2>
            <p className="text-foreground-muted text-sm">
              Answers are being <span className="text-success font-semibold">Evaluated</span>. Results will be
              available shortly.
            </p>
            <div className="bg-info-25 w-full rounded-[14px] p-4 text-left text-sm">
              <p className="font-semibold">Soon, you will see:</p>
              <ul className="text-foreground-muted mt-2 list-disc pl-5">
                <li>Your marks &amp; score breakdown.</li>
                <li>Correct answers &amp; explanations.</li>
                <li>Model answers for descriptive questions.</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Submitting your test</h2>
            <p className="text-foreground-muted text-sm">Please wait while we save your answers and calculate your score.</p>
          </>
        )}
      </div>
    </div>
  );
}

function verdict(percent: number) {
  if (percent >= 90) return 'Brilliant!';
  if (percent >= 60) return 'Passed! Nice work.';
  if (percent >= 35) return 'Keep practicing.';
  return 'Try again, you can!';
}

/** Score straight after submitting (previous app's QuizSubmitModal / MockTestCompletedModal). */
export function CompletedDialog({ summary, action }: { summary: SubmitSummary; action: ReactNode }) {
  const total = summary.totalMarks ?? 0;
  const obtained = summary.obtained ?? 0;
  const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;
  const notAnswered =
    summary.totalQuestions !== null
      ? Math.max(0, summary.totalQuestions - (summary.correct ?? 0) - (summary.incorrect ?? 0) - (summary.partial ?? 0))
      : null;
  const stats: { label: string; value: number | null; tone: string }[] = [
    { label: 'Correct', value: summary.correct, tone: 'text-success-450' },
    { label: 'Incorrect', value: summary.incorrect, tone: 'text-danger-450' },
    ...(summary.partial ? [{ label: 'Partially Correct', value: summary.partial, tone: 'text-accent-500' }] : []),
    { label: 'Not Answered', value: notAnswered, tone: 'text-foreground-muted' },
  ];
  return (
    <Dialog open>
      <DialogContent className="bg-canvas text-center" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="bg-surface flex flex-col items-center gap-3 rounded-[22px] p-6 shadow-sm">
          <CircleCheck aria-hidden className="text-success-450 size-10" />
          <DialogTitle>Test Completed!</DialogTitle>
          <DialogDescription>{verdict(percent)} See how you performed and learn from every mistake.</DialogDescription>
          <p className="text-3xl font-bold" aria-label={`Score ${obtained} out of ${total}`}>
            {obtained}
            <span className="text-foreground-subtle text-md font-medium"> / {total}</span>
          </p>
          <p className="text-foreground-subtle text-xs">Total Marks</p>
          <dl className="mt-2 grid w-full grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-canvas rounded-lg p-2">
                <dt className="text-foreground-muted text-[11px]">{stat.label}</dt>
                <dd className={`text-lg font-bold ${stat.tone}`}>{stat.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {summary.totalQuestions !== null && (
            <p className="text-foreground-muted text-xs">Total Questions: {summary.totalQuestions}</p>
          )}
        </div>
        <DialogFooter className="justify-center">{action}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
