'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, FieldError } from '@prepzy/design-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { DEFAULT_EXAM } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint, rememberExam } from '../device';
import { authKeys, homeFor } from '../hooks';
import { otpFormSchema as schema } from '../schemas';
import { useOnboardingHydrated, useOnboardingStore } from '../onboarding-store';
import { HERO_GRADIENT, Waves } from './auth-screen';
import { BackLink, StepDashes, StepLabel } from './onboarding-step';

const RESEND_SECONDS = 59;
const CODE_LENGTH = 6;
/** The OTP is step 2 of both flows (phone → code), so the original shows the same progress for login. */
const OTP_STEP = 2;

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

/** 22-unit icon paths drawn in a 20px box with a 24-unit view box, exactly as the original nested its SVGs. */
const icon = (paths: ReactNode) => (
  <svg
    aria-hidden
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.925"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths}
  </svg>
);

/** "What's waiting inside" — the original's feature cards. */
const FEATURES = [
  {
    name: 'AI video lectures',
    desc: 'Chapter-wise, for your exam',
    icon: icon(
      <>
        <path d="M17.4167 2.75H4.58333C3.57081 2.75 2.75 3.57081 2.75 4.58333V17.4167C2.75 18.4292 3.57081 19.25 4.58333 19.25H17.4167C18.4292 19.25 19.25 18.4292 19.25 17.4167V4.58333C19.25 3.57081 18.4292 2.75 17.4167 2.75Z" />
        <path d="M6.41667 2.75V19.25M15.5833 2.75V19.25M2.75 11H19.25" />
      </>,
    ),
  },
  {
    name: 'Step-by-step doubt help',
    desc: 'Any question, worked out',
    icon: icon(
      <path d="M7.24171 18.3333C8.99124 19.2308 11.0038 19.4739 12.9167 19.0188C14.8296 18.5637 16.517 17.4403 17.675 15.8512C18.8329 14.262 19.3852 12.3115 19.2322 10.3511C19.0793 8.39081 18.2312 6.54956 16.8409 5.15918C15.4505 3.7688 13.6092 2.92073 11.6489 2.7678C9.68856 2.61487 7.73806 3.16713 6.14888 4.32506C4.55969 5.483 3.43634 7.17045 2.98124 9.08336C2.52615 10.9963 2.76924 13.0088 3.66671 14.7583L1.83337 20.1667L7.24171 18.3333Z" />,
    ),
  },
  {
    name: 'Tests and mocks',
    desc: 'Real exam pattern, timed',
    icon: icon(
      <>
        <path d="M13.75 1.83334H8.25004C7.74378 1.83334 7.33337 2.24374 7.33337 2.75V4.58334C7.33337 5.0896 7.74378 5.5 8.25004 5.5H13.75C14.2563 5.5 14.6667 5.0896 14.6667 4.58334V2.75C14.6667 2.24374 14.2563 1.83334 13.75 1.83334Z" />
        <path d="M14.6666 3.66666H16.5C16.9862 3.66666 17.4525 3.85982 17.7963 4.20363C18.1401 4.54745 18.3333 5.01377 18.3333 5.5V18.3333C18.3333 18.8196 18.1401 19.2859 17.7963 19.6297C17.4525 19.9735 16.9862 20.1667 16.5 20.1667H5.49996C5.01373 20.1667 4.54741 19.9735 4.2036 19.6297C3.85978 19.2859 3.66663 18.8196 3.66663 18.3333V5.5C3.66663 5.01377 3.85978 4.54745 4.2036 4.20363C4.54741 3.85982 5.01373 3.66666 5.49996 3.66666H7.33329" />
        <path d="M8.25 11H13.75M8.25 14.6667H13.75" />
      </>,
    ),
  },
  {
    name: 'Past papers',
    desc: 'Solved and timed',
    icon: icon(
      <path d="M5.49992 8.25H4.12492C3.51713 8.25 2.93424 8.00856 2.50447 7.57879C2.07469 7.14902 1.83325 6.56612 1.83325 5.95834C1.83325 5.35055 2.07469 4.76765 2.50447 4.33788C2.93424 3.90811 3.51713 3.66667 4.12492 3.66667H5.49992M5.49992 8.25V1.83334H16.4999V8.25M5.49992 8.25C5.49992 9.70869 6.07938 11.1076 7.11083 12.1391C8.14228 13.1705 9.54123 13.75 10.9999 13.75C12.4586 13.75 13.8576 13.1705 14.889 12.1391C15.9205 11.1076 16.4999 9.70869 16.4999 8.25M16.4999 8.25H17.8749C18.4827 8.25 19.0656 8.00856 19.4954 7.57879C19.9251 7.14902 20.1666 6.56612 20.1666 5.95834C20.1666 5.35055 19.9251 4.76765 19.4954 4.33788C19.0656 3.90811 18.4827 3.66667 17.8749 3.66667H16.4999M3.66659 20.1667H18.3333M9.16659 13.475V15.5833C9.16659 16.1333 8.70825 16.5 8.24992 16.6833C7.24159 17.2333 6.41659 18.5167 6.41659 20.1667M12.8333 13.475V15.5833C12.8333 16.1333 13.2916 16.5 13.7499 16.6833C14.7583 17.2333 15.5833 18.5167 15.5833 20.1667" />,
    ),
  },
] as const;

/**
 * Verify screen of both flows, as in the original: back link and step dashes, "Verify your number", a card with
 * six digit boxes, Verify & continue and the resend countdown, then "What's waiting inside".
 * The boxes are a picture of one real input (label "One-time code"), so typing, paste and SMS/WhatsApp autofill
 * all work natively.
 */
export function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { phone, flow: storedFlow, reset } = useOnboardingStore();
  const flow = searchParams.get('flow') === 'signup' ? 'signup' : (storedFlow ?? 'login');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { otp: '' } });
  // Set once verification succeeds, so clearing the flow state doesn't trigger the restart below.
  const completed = useRef(false);
  const backHref = flow === 'signup' ? routes.getStarted() : routes.login();

  // Arriving here without a phone number (e.g. a bookmarked URL) restarts the flow.
  const hydrated = useOnboardingHydrated();
  useEffect(() => {
    if (hydrated && !phone && !completed.current) router.replace(backHref);
  }, [hydrated, phone, backHref, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: async (otp: string) => {
      if (!phone) throw new Error('Missing phone');
      if (flow === 'signup') {
        await authApi.verifySignupOtp(phone, otp);
        return null;
      }
      return authApi.verifyLoginOtp(phone, otp, await getDeviceFingerprint());
    },
    onSuccess: (student) => {
      if (!student) {
        router.push(routes.examSelection());
        return;
      }
      completed.current = true;
      queryClient.setQueryData(authKeys.me, student);
      rememberExam(student.targetExam ?? DEFAULT_EXAM);
      router.replace(safeNext(searchParams.get('next')) ?? homeFor(student));
      reset();
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendOtp(phone ?? '', flow),
    onSuccess: () => {
      setSecondsLeft(RESEND_SECONDS);
      toast.success('A new code is on its way.');
    },
    onError: (error) => toast.error(userMessage(error)),
  });

  const sentTo = `We sent a 6-digit code on WhatsApp to ${phone || 'your number'}.`;

  return (
    <div className="bg-onboarding-warm lg:bg-onboarding-page flex min-h-dvh flex-col overflow-x-hidden leading-[1.75]">
      {/* Desktop: back link and step dashes on the page. */}
      <header className="hidden items-center justify-between px-10 py-4 lg:flex">
        <BackLink href={backHref} />
        <span className="flex items-center gap-2.5">
          <StepLabel step={OTP_STEP} className="text-foreground-subtle text-[12px] font-bold" />
          <StepDashes current={OTP_STEP} active="bg-brand w-[22px] rounded-[3px]" done="bg-brand w-3.5 rounded-[3px]" todo="bg-line w-3.5 rounded-[3px]" />
        </span>
      </header>

      {/* Mobile: the same on a rounded gradient hero. */}
      <div className={`${HERO_GRADIENT} relative shrink-0 overflow-hidden rounded-b-[28px] px-6 pt-4 pb-[52px] lg:hidden`}>
        <div className="relative z-10 mb-[22px] flex items-center justify-between py-1.5">
          <BackLink href={backHref} onBrand />
          <StepLabel step={OTP_STEP} className="sr-only" />
          <StepDashes
            current={OTP_STEP}
            count={4}
            className="gap-[5px]"
            active="w-[22px] rounded-[3px] bg-on-brand"
            done="w-1.5 rounded-[3px] bg-on-brand/30"
            todo="w-1.5 rounded-[3px] bg-on-brand/30"
          />
        </div>
        <h1 className="font-display text-on-brand relative z-10 mb-2 text-[26px] leading-[1.2] font-extrabold tracking-[-0.3px]">
          Verify your number
        </h1>
        <p className="font-plain relative z-10 text-[13px] leading-[1.5] text-on-brand/75">{sentTo}</p>
        <Waves className="h-[90px]" lines={2} />
      </div>

      <main id="main" className="flex flex-1 flex-col lg:items-center lg:px-10 lg:pt-8 lg:pb-12">
        <h1 className="font-display text-ink mb-2 hidden text-center text-[32px] leading-[1.15] font-black tracking-[-0.3px] lg:block">
          Verify your number
        </h1>
        <p className="font-plain text-foreground-soft mb-7 hidden text-center text-[14px] leading-[1.6] lg:block">{sentTo}</p>

        <form
          noValidate
          onSubmit={form.handleSubmit(({ otp }) => verify.mutate(otp))}
          className="bg-surface shadow-onboarding-card-float lg:border-line lg:shadow-onboarding-card relative z-10 mx-5 -mt-8 flex flex-col items-center rounded-xl p-5 lg:mx-0 lg:mt-0 lg:border lg:p-7"
        >
          <div className="flex w-[299px] flex-col lg:w-[386px]">
            <CodeBoxes
              value={form.watch('otp')}
              invalid={!!form.formState.errors.otp}
              registration={form.register('otp')}
            />
            <FieldError className="text-onboarding-error mt-2 text-center text-[13px] font-semibold">
              {form.formState.errors.otp?.message}
            </FieldError>
            <Button
              type="submit"
              loading={verify.isPending}
              className={`bg-brand hover:bg-brand text-on-brand mt-[18px] h-auto w-full rounded-[14px] border-none py-3.5 text-[15px] leading-[1.75] font-bold transition-[box-shadow,opacity] ${
                form.watch('otp').length === CODE_LENGTH ? 'shadow-onboarding-verify' : 'opacity-50 shadow-none'
              }`}
            >
              Verify &amp; continue
            </Button>
            {verify.isError && (
              <Alert tone="danger" className="mt-3">
                {userMessage(verify.error, 'That code is not valid. Please try again.')}
              </Alert>
            )}
          </div>
          <p className="text-brand mt-3.5 text-center text-[13px] lg:mt-4" aria-live="polite">
            Didn&apos;t receive it?{' '}
            <button
              type="button"
              disabled={secondsLeft > 0 || resend.isPending}
              onClick={() => resend.mutate()}
              className={`font-bold ${
                secondsLeft > 0 ? 'text-accent-400' : resend.isPending ? 'text-foreground-subtle' : 'text-brand cursor-pointer'
              }`}
            >
              {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : resend.isPending ? 'Sending…' : 'Resend OTP'}
            </button>
          </p>
        </form>

        <section className="px-5 pt-7 pb-4 lg:w-full lg:max-w-[900px] lg:px-0 lg:pt-0 lg:pb-0">
          <h2 className="font-display text-ink mb-3.5 text-[18px] font-black lg:mt-[34px] lg:mb-5 lg:text-center lg:text-[22px] lg:font-bold">
            What&apos;s waiting inside
          </h2>
          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-4 lg:gap-4">
            {FEATURES.map((feature) => (
              <li
                key={feature.name}
                className="bg-surface shadow-onboarding-tile lg:border-line flex items-start gap-3.5 rounded-[14px] px-4 py-3.5 lg:flex-col lg:gap-3 lg:rounded-lg lg:border lg:p-5 lg:shadow-none"
              >
                <span className="bg-brand-soft text-brand grid size-11 shrink-0 place-items-center rounded-md">
                  {feature.icon}
                </span>
                <span>
                  <span className="font-display text-ink mb-0.5 block text-[14px] font-bold lg:mb-[3px]">
                    {feature.name}
                  </span>
                  <span className="font-display lg:font-sans text-foreground-soft block text-[12px] leading-[1.5]">
                    {feature.desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

/** One input drawn as six boxes; the box after the last digit is highlighted while the input has focus. */
function CodeBoxes({
  value,
  invalid,
  registration,
}: {
  value: string;
  invalid: boolean;
  registration: ReturnType<ReturnType<typeof useForm<z.infer<typeof schema>>>['register']>;
}) {
  const [focused, setFocused] = useState(false);
  const digits = value.slice(0, CODE_LENGTH);
  const caret = Math.min(digits.length, CODE_LENGTH - 1);
  return (
    <div className="relative">
      <div aria-hidden className="flex gap-[7px] lg:gap-2.5">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = digits[i];
          // The hidden input's own caret can't show, so the active box draws a blinking one
          // (after the last digit once all six are typed).
          const showCaret = focused && i === caret;
          return (
            <span
              key={i}
              className={`flex h-[52px] w-11 shrink-0 items-center justify-center rounded-[13px] border-[2.5px] text-[20px] font-extrabold transition-all lg:h-[62px] lg:w-14 lg:rounded-[14px] lg:text-[24px] ${
                digit
                  ? 'border-brand bg-brand-soft text-brand'
                  : `bg-onboarding-box text-ink ${
                      invalid ? 'border-onboarding-error' : focused && i === caret ? 'border-brand-200' : 'border-line'
                    }`
              }`}
            >
              {digit}
              {showCaret && (
                <span
                  data-testid="otp-caret"
                  className={`otp-caret bg-brand h-6 w-0.5 rounded-full lg:h-7 ${digit ? 'ml-0.5' : ''}`}
                />
              )}
            </span>
          );
        })}
      </div>
      <label htmlFor="otp" className="sr-only">
        One-time code
      </label>
      <input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-invalid={invalid}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
        {...registration}
        onChange={(event) => {
          // Digits only, like the original boxes (paste "123 456" works too).
          event.target.value = event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
          return registration.onChange(event);
        }}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false);
          return registration.onBlur(event);
        }}
      />
    </div>
  );
}
