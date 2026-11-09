'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Field, FieldError, FieldLabel, Input } from '@prepzy/design-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
import { useOnboardingStore } from '../onboarding-store';

const RESEND_SECONDS = 59;

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

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

  // Arriving here without a phone number (e.g. a bookmarked URL) restarts the flow.
  useEffect(() => {
    if (!phone && !completed.current) router.replace(flow === 'signup' ? routes.getStarted() : routes.login());
  }, [phone, flow, router]);

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

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={form.handleSubmit(({ otp }) => verify.mutate(otp))}>
      <p className="text-foreground-muted text-sm">
        Enter the 6-digit code sent to <span className="text-foreground font-semibold">{phone}</span>
      </p>
      <Field>
        <FieldLabel htmlFor="otp">One-time code</FieldLabel>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          size="lg"
          className="tracking-[0.5em]"
          invalid={!!form.formState.errors.otp}
          {...form.register('otp')}
        />
        <FieldError>{form.formState.errors.otp?.message}</FieldError>
      </Field>
      {verify.isError && (
        <Alert tone="danger">{userMessage(verify.error, 'That code is not valid. Please try again.')}</Alert>
      )}
      <Button type="submit" size="lg" width="full" loading={verify.isPending}>
        Verify
      </Button>
      <Button
        intent="ghost"
        disabled={secondsLeft > 0 || resend.isPending}
        onClick={() => resend.mutate()}
        aria-live="polite"
      >
        {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
      </Button>
    </form>
  );
}
