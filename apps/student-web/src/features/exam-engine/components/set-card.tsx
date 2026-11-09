'use client';

import { Badge, Button, Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@prepzy/design-system';
import { ClipboardList, Clock } from 'lucide-react';
import Link from 'next/link';
import type { TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import type { TestSetSummary } from '../model';

const STATUS_BADGE = {
  new: { label: 'Not started', tone: 'neutral' },
  'in-progress': { label: 'In progress', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
} as const;

export function SetCard({ set, testType }: { set: TestSetSummary; testType: TestTypeKey }) {
  const exam = useExam();
  const badge = STATUS_BADGE[set.status];
  const startLabel = set.status === 'in-progress' ? 'Resume' : set.status === 'completed' ? 'Retake' : 'Start';
  const canRetake = !(testType === 'dpp' && set.status === 'completed');
  return (
    <Card className="h-full justify-between">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{set.title}</CardTitle>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        {set.subtitle && <CardDescription>{set.subtitle}</CardDescription>}
      </CardHeader>
      <ul className="text-foreground-muted flex flex-wrap gap-4 text-xs">
        {set.questionCount !== null && (
          <li className="flex items-center gap-1">
            <ClipboardList aria-hidden className="size-4" />
            {set.questionCount} questions
          </li>
        )}
        {set.durationMinutes !== null && (
          <li className="flex items-center gap-1">
            <Clock aria-hidden className="size-4" />
            {set.durationMinutes} min
          </li>
        )}
        {set.lastScore && (
          <li>
            Last score {set.lastScore.obtained}/{set.lastScore.total}
          </li>
        )}
      </ul>
      <CardFooter>
        {canRetake && (
          <Button asChild size="sm">
            <Link href={routes.testPlayer(exam.slug, testType, set.id)}>{startLabel}</Link>
          </Button>
        )}
        {set.lastAttemptId && (
          <Button asChild size="sm" intent="ghost">
            <Link href={routes.testResult(exam.slug, testType, set.lastAttemptId)}>View result</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
