'use client';

import { Alert, Badge, Button, OptionGroup, OptionTile, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { findExam } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { useOnboardingStore } from '../onboarding-store';

export function ExamPicker() {
  const router = useRouter();
  const { phone, examId, preselectedExam, selectExam } = useOnboardingStore();
  const exams = useQuery({ queryKey: ['auth', 'exam-options'], queryFn: authApi.examOptions, staleTime: Infinity });
  const [selected, setSelected] = useState<string>(examId ? String(examId) : '');

  useEffect(() => {
    if (!phone) router.replace(routes.getStarted());
  }, [phone, router]);

  // Preselect the exam from a marketing link once the list arrives.
  useEffect(() => {
    if (selected || !exams.data || !preselectedExam) return;
    const match = exams.data.find((e) => e.name.toLowerCase() === preselectedExam.toLowerCase());
    if (match) setSelected(String(match.examId));
  }, [exams.data, preselectedExam, selected]);

  if (exams.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (exams.isError) return <Alert tone="danger">{userMessage(exams.error)}</Alert>;

  const choice = exams.data.find((e) => String(e.examId) === selected);

  return (
    <div className="flex flex-col gap-5">
      <OptionGroup aria-label="Exam" value={selected} onValueChange={setSelected}>
        {exams.data.map((exam) => {
          const available = !exam.comingSoon && !!findExam(exam.examSlice);
          return (
            <OptionTile
              key={exam.examId}
              value={String(exam.examId)}
              marker={exam.name.charAt(0)}
              disabled={!available}
            >
              <span className="flex items-center justify-between gap-2">
                {exam.name}
                {!available && <Badge tone="neutral">Coming soon</Badge>}
              </span>
            </OptionTile>
          );
        })}
      </OptionGroup>
      <Button
        size="lg"
        width="full"
        disabled={!choice}
        onClick={() => {
          if (!choice) return;
          selectExam(choice.examId, choice.name);
          router.push(routes.setup());
        }}
      >
        Continue
      </Button>
    </div>
  );
}
