'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { useOnboardingStore } from '../onboarding-store';
import { phoneFormSchema } from '../schemas';
import { AuthSubmit, AuthSwitch } from './auth-screen';
import { PhoneField } from './phone-field';

type Values = z.input<typeof phoneFormSchema>;
type Parsed = z.output<typeof phoneFormSchema>;

const FORM_ID = 'signup-form';

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startOtp, setPreselection } = useOnboardingStore();
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { country: 'IN', phone: '' },
  });

  // Marketing links: /get-started?class_id=12&exam=NEET-UG&ref=CODE
  useEffect(() => {
    const classId = Number(searchParams.get('class_id'));
    const ref = searchParams.get('ref')?.trim() || null;
    setPreselection({
      classId: Number.isFinite(classId) && classId > 0 ? classId : null,
      exam: searchParams.get('exam'),
      referralCode: ref,
    });
    // The welcome screen after sign-up applies this code (plans' REFERRAL_CODE_KEY), as the previous app did.
    if (ref) {
      try {
        localStorage.setItem('prepzy_referral_code', ref.slice(0, 64));
      } catch {
        // Private mode: the student can still type the code on the welcome screen.
      }
    }
  }, [searchParams, setPreselection]);

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ otpVerified }, phone) => {
      startOtp(phone, 'signup');
      router.push(otpVerified ? routes.examSelection() : routes.verifyOtp('signup'));
    },
  });

  const error = form.formState.errors.phone?.message ?? (register.isError ? userMessage(register.error) : undefined);

  return (
    <form
      id={FORM_ID}
      className="flex flex-col"
      noValidate
      onSubmit={form.handleSubmit((phone) => register.mutate(phone))}
    >
      <PhoneField
        country={form.watch('country')}
        onCountryChange={(iso) => form.setValue('country', iso)}
        registration={form.register('phone')}
        error={error}
        labelClassName="text-onboarding-label"
      />
      <AuthSubmit form={FORM_ID} variant="signup" loading={register.isPending}>
        Get OTP on WhatsApp
      </AuthSubmit>
      <AuthSwitch prompt="Already have an account?" href={routes.login()} className="py-6 text-[13px] lg:hidden">
        Login
      </AuthSwitch>
      <AuthSwitch prompt="Already have an account?" href={routes.login()} className="mt-6 hidden text-[14px] lg:block">
        Login here
      </AuthSwitch>
    </form>
  );
}
