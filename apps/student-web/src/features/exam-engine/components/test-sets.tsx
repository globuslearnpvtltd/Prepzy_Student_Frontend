'use client';

import { Alert, Skeleton, Tabs, TabsList, TabsTrigger, cx } from '@prepzy/design-system';
import { useEffect, useState } from 'react';
import type { TestTypeKey } from '@/shared/config/exams';
import { useExam } from '@/shared/hooks/use-exam';
import { StatusScreen } from '@/shared/layout/status-screens';
import { userMessage } from '@/shared/lib/errors';
import { useAdapter, useSubjects, useTestContext, useTestSets } from '../hooks';
import type { TestContext } from '../model';
import { TEST_TYPES } from '../test-types';
import { SetCard } from './set-card';

/** Papers of one test type, grouped by subject when the backend groups them. */
export function TestSets({ testType }: { testType: TestTypeKey }) {
  const adapter = useAdapter(testType);
  const { context, isPending, error } = useTestContext();
  const meta = TEST_TYPES[testType];
  const exam = useExam();

  if (!adapter) return <StatusScreen title="This test type isn't available" />;
  if (!adapter.listSets)
    return (
      <StatusScreen
        title={meta.label}
        description="These tests open from your chapters in Learn. Pick a chapter to start one."
      />
    );

  return (
    // Competitive pages add p-3 inside the shell padding, as the previous app's NEET test pages did.
    <div className={cx('flex flex-col gap-6', exam.category === 'competitive' && 'p-3')}>
      <header>
        <h1 className="text-2xl font-semibold">{meta.label}</h1>
        <p className="text-foreground-muted text-sm">{meta.description}</p>
      </header>
      {isPending ? (
        <SetGridSkeleton />
      ) : error ? (
        <Alert tone="danger">{userMessage(error)}</Alert>
      ) : !context ? (
        <Alert tone="info">You need an active plan to take tests.</Alert>
      ) : adapter.listSubjects ? (
        <SubjectSets testType={testType} context={context} />
      ) : (
        <SetGrid testType={testType} context={context} />
      )}
    </div>
  );
}

function SubjectSets({ testType, context }: { testType: TestTypeKey; context: TestContext }) {
  const subjects = useSubjects(testType, context);
  const [subjectId, setSubjectId] = useState<string>();

  useEffect(() => {
    if (!subjectId && subjects.data?.[0]) setSubjectId(subjects.data[0].id);
  }, [subjects.data, subjectId]);

  if (subjects.isPending) return <SetGridSkeleton />;
  if (subjects.isError) return <Alert tone="danger">{userMessage(subjects.error)}</Alert>;
  if (subjects.data.length === 0) return <Alert tone="info">No papers are available for your class yet.</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={subjectId} onValueChange={setSubjectId}>
        <TabsList aria-label="Subjects">
          {subjects.data.map((subject) => (
            <TabsTrigger key={subject.id} value={subject.id}>
              {subject.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {subjectId && <SetGrid testType={testType} context={context} subjectId={subjectId} />}
    </div>
  );
}

function SetGrid({
  testType,
  context,
  subjectId,
}: {
  testType: TestTypeKey;
  context: TestContext;
  subjectId?: string;
}) {
  const sets = useTestSets(testType, context, subjectId);
  if (sets.isPending) return <SetGridSkeleton />;
  if (sets.isError) return <Alert tone="danger">{userMessage(sets.error)}</Alert>;
  if (sets.data.length === 0) return <Alert tone="info">No papers here yet. Check back soon.</Alert>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sets.data.map((set) => (
        <li key={set.id}>
          <SetCard set={set} testType={testType} />
        </li>
      ))}
    </ul>
  );
}

function SetGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading papers">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
