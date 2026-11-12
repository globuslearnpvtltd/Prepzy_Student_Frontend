'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint } from '../device';
import { useOnboardingStore } from '../onboarding-store';
import { phoneFormSchema } from '../schemas';
import { AuthSubmit, AuthSwitch } from './auth-screen';
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
      <AuthSwitch
        prompt="New to Prepzy?"
        href={routes.getStarted()}
        className="font-display py-6 text-[13px] lg:hidden"
      >
        Sign up for free
      </AuthSwitch>
      <AuthSubmit form={FORM_ID} loading={requestOtp.isPending}>
        Send OTP
      </AuthSubmit>
      <AuthSwitch
        prompt="New to Prepzy?"
        href={routes.getStarted()}
        className="mt-6 hidden text-[14px] lg:block"
        linkClassName="font-display"
      >
        Sign up for free
      </AuthSwitch>
    </form>
  );
}
