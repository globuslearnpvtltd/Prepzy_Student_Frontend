'use client';

import { Alert, Button, OptionGroup, OptionTile, Skeleton } from '@prepzy/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findExam, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint, rememberExam } from '../device';
import { authKeys } from '../hooks';
import { useOnboardingStore } from '../onboarding-store';

/** Final sign-up step: board exams pick a class, competitive exams pick a target year. */
export function SetupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { phone, examId, preselectedClassId, reset } = useOnboardingStore();
  const catalog = useExamCatalog();
  const exam = useMemo(() => {
    const entry = catalog.data?.find((e) => e.examId === examId);
    const design = entry ? findExam(entry.examSlice) : null;
    return entry && design ? { ...design, examId: entry.examId } : null;
  }, [catalog.data, examId]);
  const [choice, setChoice] = useState('');
  const [withBoard, setWithBoard] = useState(false);
  // Set once onboarding succeeds, so clearing the flow state doesn't trigger the restart below.
  const completed = useRef(false);

  useEffect(() => {
    if (completed.current) return;
    if (!phone) router.replace(routes.getStarted());
    else if (catalog.isSuccess && !exam) router.replace(routes.examSelection());
  }, [phone, exam, catalog.isSuccess, router]);

  const complete = useMutation({
    mutationFn: async (target: ExamConfig) => {
      const fingerprint = await getDeviceFingerprint();
      const byYear = target.onboarding.kind === 'choose-target-year';
      return authApi.completeOnboarding({
        phone: phone ?? '',
        examId: target.examId,
        classId: target.onboarding.kind === 'choose-target-year' ? target.onboarding.classId : Number(choice),
        planLength: byYear ? Number(choice) : undefined,
        withCbse: byYear ? withBoard : undefined,
        fingerprint,
      });
    },
    onSuccess: (student, target) => {
      completed.current = true;
      queryClient.setQueryData(authKeys.me, student);
      rememberExam(target.slug);
      // Welcome screen first (free Topper month, coupon / referral code), then the dashboard.
      router.replace(routes.welcome(target.slug));
      reset();
    },
  });

  if (!exam) return null;

  return (
    <div className="flex flex-col gap-5">
      {exam.onboarding.kind === 'choose-class' ? (
        <ClassChoice exam={exam} value={choice} onChange={setChoice} preselected={preselectedClassId} />
      ) : (
        <>
          <TargetYearChoice value={choice} onChange={setChoice} examLabel={exam.label} />
          {exam.onboarding.boardAddOnLabel && (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={withBoard}
                onChange={(e) => setWithBoard(e.target.checked)}
              />
              {exam.onboarding.boardAddOnLabel}
            </label>
          )}
        </>
      )}
      {complete.isError && <Alert tone="danger">{userMessage(complete.error)}</Alert>}
      <Button
        size="lg"
        width="full"
        disabled={!choice}
        loading={complete.isPending}
        onClick={() => complete.mutate(exam)}
      >
        Start learning
      </Button>
    </div>
  );
}

function ChoiceSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ClassChoice({
  exam,
  value,
  onChange,
  preselected,
}: {
  exam: ExamConfig;
  value: string;
  onChange: (value: string) => void;
  preselected: number | null;
}) {
  const classes = useQuery({
    queryKey: ['auth', 'class-options', exam.examId],
    queryFn: () => authApi.classOptions(exam),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!value && preselected && classes.data?.some((c) => c.classId === preselected)) onChange(String(preselected));
  }, [classes.data, preselected, value, onChange]);

  if (classes.isPending) return <ChoiceSkeleton />;
  if (classes.isError) return <Alert tone="danger">{userMessage(classes.error)}</Alert>;
  return (
    <OptionGroup aria-label="Your class" value={value} onValueChange={onChange}>
      {classes.data.map((c) => (
        <OptionTile key={c.classId} value={String(c.classId)}>
          {c.title}
          {c.streamName && <span className="text-foreground-muted"> · {c.streamName}</span>}
        </OptionTile>
      ))}
    </OptionGroup>
  );
}

function TargetYearChoice({
  value,
  onChange,
  examLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  examLabel: string;
}) {
  const lengths = useQuery({
    queryKey: ['auth', 'plan-lengths'],
    queryFn: authApi.neetPlanLengths,
    staleTime: Infinity,
  });
  if (lengths.isPending) return <ChoiceSkeleton />;
  if (lengths.isError) return <Alert tone="danger">{userMessage(lengths.error)}</Alert>;
  const year = new Date().getFullYear();
  return (
    <OptionGroup aria-label="Target year" value={value} onValueChange={onChange}>
      {lengths.data.map((length) => (
        <OptionTile key={length} value={String(length)}>
          {examLabel} {year + length}
        </OptionTile>
      ))}
    </OptionGroup>
  );
}
