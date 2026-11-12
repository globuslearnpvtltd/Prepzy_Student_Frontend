'use client';

import { Alert, OptionGroup, OptionTile, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { findExam } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import type { ExamOption } from '../model';
import { useOnboardingHydrated, useOnboardingStore } from '../onboarding-store';
import { CHOICE_CARD, ChoiceDot, ContinueButton, OnboardingNotice, OnboardingStep } from './onboarding-step';

const EXAM_STEP = 3;

/** "A and B" / "A, B and C". */
const listOf = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');

export function ExamPicker() {
  const router = useRouter();
  const { phone, examId, preselectedExam, selectExam } = useOnboardingStore();
  const exams = useQuery({ queryKey: ['auth', 'exam-options'], queryFn: authApi.examOptions, staleTime: Infinity });
  const [selected, setSelected] = useState<string>(examId ? String(examId) : '');

  const hydrated = useOnboardingHydrated();

  useEffect(() => {
    if (hydrated && !phone) router.replace(routes.getStarted());
  }, [hydrated, phone, router]);

  // Preselect the exam from a marketing link once the list arrives.
  useEffect(() => {
    if (selected || !exams.data || !preselectedExam) return;
    const match = exams.data.find((e) => e.name.toLowerCase() === preselectedExam.toLowerCase());
    if (match) setSelected(String(match.examId));
  }, [exams.data, preselectedExam, selected]);

  const choice = exams.data?.find((e) => String(e.examId) === selected);
  const live = exams.data?.filter((e) => !e.comingSoon).map((e) => e.name) ?? [];
  const soon = exams.data?.filter((e) => e.comingSoon).map((e) => e.name) ?? [];

  return (
    <OnboardingStep
      step={EXAM_STEP}
      backHref={routes.getStarted()}
      title="Which exam are you preparing for?"
      subtitle="We'll set up the right subjects and tests for you."
      mobileSubtitle="We'll set up the right subjects and tests."
      footer={
        <ContinueButton
          disabled={!choice}
          onClick={() => {
            if (!choice) return;
            selectExam(choice.examId, choice.name);
            router.push(routes.setup());
          }}
        />
      }
    >
      {exams.isPending ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[106px] w-full rounded-[20px] lg:h-[282px] lg:rounded-2xl" />
          ))}
        </div>
      ) : exams.isError ? (
        <Alert tone="danger">{userMessage(exams.error)}</Alert>
      ) : (
        <>
          <OptionGroup
            aria-label="Exam"
            value={selected}
            onValueChange={setSelected}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {exams.data.map((exam) => (
              <ExamCard key={exam.examId} exam={exam} selected={String(exam.examId) === selected} />
            ))}
          </OptionGroup>
          {live.length > 0 && (
            <OnboardingNotice>
              {listOf(live)} {live.length > 1 ? 'are' : 'is'} live.
              {soon.length > 0 && ` ${listOf(soon)} ${soon.length > 1 ? 'are' : 'is'} on the way.`}
            </OnboardingNotice>
          )}
        </>
      )}
    </OnboardingStep>
  );
}

const Soon = ({ className }: { className: string }) => (
  <span
    aria-hidden
    className={`bg-accent-400/20 text-onboarding-notice-icon rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.5px] ${className}`}
  >
    SOON
  </span>
);

/** Exam card: a row with a thumbnail on mobile, a column with the illustration on desktop. */
function ExamCard({ exam, selected }: { exam: ExamOption; selected: boolean }) {
  const available = !exam.comingSoon;
  const tagline = findExam(exam.examSlice)?.tagline;
  return (
    <OptionTile
      value={String(exam.examId)}
      disabled={!available}
      className={`${CHOICE_CARD} relative rounded-[20px] p-6 lg:rounded-2xl lg:px-10`}
    >
      <span className="flex items-center gap-6 text-left lg:flex-col lg:gap-0 lg:text-center">
        {!available && <Soon className="absolute top-3 right-3 hidden lg:inline-flex" />}
        <ExamImage exam={exam} />
        <span className="min-w-0 flex-1 lg:flex-none">
          <span className="flex items-center gap-2 lg:justify-center">
            <span
              className={`font-display text-[19px] font-extrabold lg:text-[18px] lg:font-bold ${
                available ? 'text-ink' : 'text-foreground-subtle'
              }`}
            >
              {exam.name}
            </span>
            {!available && <Soon className="shrink-0 lg:hidden" />}
            {!available && <span className="sr-only">Coming soon</span>}
          </span>
          {tagline && (
            <span className="font-display text-foreground-subtle mt-0.5 block text-[12px] lg:mt-1 lg:leading-[1.4]">
              {tagline}
            </span>
          )}
        </span>
        <ChoiceDot selected={selected} className="lg:mt-6" />
      </span>
    </OptionTile>
  );
}

/** Illustration named after the backend's exam slice (public/illustrations/exams/<slice>.png); initial as fallback. */
function ExamImage({ exam }: { exam: ExamOption }) {
  const [missing, setMissing] = useState(false);
  return (
    <span className="bg-brand-soft flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg lg:mb-6 lg:size-auto lg:h-[130px] lg:bg-transparent">
      {missing ? (
        <span aria-hidden className="font-display text-brand text-[30px] font-extrabold">
          {exam.name.charAt(0)}
        </span>
      ) : (
        <Image
          src={`/illustrations/exams/${exam.examSlice}.png`}
          alt=""
          width={704}
          height={624}
          onError={() => setMissing(true)}
          className="size-full object-cover object-top lg:h-[130px] lg:w-auto lg:object-contain"
        />
      )}
    </span>
  );
}
