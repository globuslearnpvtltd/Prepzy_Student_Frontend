'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint } from '../device';
import { useOnboardingStore } from '../onboarding-store';
import { phoneFormSchema } from '../schemas';
import { AuthSubmit } from './auth-screen';
import { PhoneField } from './phone-field';

type Values = z.input<typeof phoneFormSchema>;
type Parsed = z.output<typeof phoneFormSchema>;

const FORM_ID = 'login-form';

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const startOtp = useOnboardingStore((state) => state.startOtp);
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { country: 'IN', phone: '' },
  });

  const requestOtp = useMutation({
    mutationFn: async (phone: string) => authApi.requestLoginOtp(phone, await getDeviceFingerprint()),
    onSuccess: (_, phone) => {
      startOtp(phone, 'login');
      const query = next ? `&next=${encodeURIComponent(next)}` : '';
      router.push(`${routes.verifyOtp('login')}${query}`);
    },
  });

  const error =
    form.formState.errors.phone?.message ?? (requestOtp.isError ? userMessage(requestOtp.error) : undefined);

  return (
    <form
      id={FORM_ID}
      className="flex flex-col"
      noValidate
      onSubmit={form.handleSubmit((phone) => requestOtp.mutate(phone))}
    >
      <PhoneField
        country={form.watch('country')}
        onCountryChange={(iso) => form.setValue('country', iso)}
        registration={form.register('phone')}
        error={error}
      />
      <AuthSubmit form={FORM_ID} loading={requestOtp.isPending}>
        Send OTP
      </AuthSubmit>
      <p className="text-foreground-soft mt-4 py-2 text-center text-[13px] lg:text-sm">
        New to Prepzy?{' '}
        <Link className="font-display text-brand font-bold underline underline-offset-2" href={routes.getStarted()}>
          Sign up for free
        </Link>
      </p>
    </form>
  );
}
