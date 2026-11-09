'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { userMessage } from '@/shared/lib/errors';
import { useRequestTeacherOtp, useVerifyTeacherOtp } from '../hooks';
import { emailFormSchema, otpFormSchema } from '../schemas';

const FEATURES = [
  { title: 'Real-time progress tracking', desc: 'Monitor scores and performance across all subjects instantly.' },
  { title: 'Learning Hours Tracking', desc: 'Get a detailed overview on how much time your student spends on Prepzy.' },
  { title: 'Doubt Clarification Status', desc: 'See how many doubts get resolved via the Prepzy 24/7 Teacher.' },
  { title: 'Strengths & Weakness Analytics', desc: "Instant insights on your student's standing and weak areas." },
];

const OTP_LENGTH = 6;
const primaryButton =
  'bg-brand-700 text-neutral-0 hover:bg-brand-600 w-full rounded-sm py-[16px] text-[16px] font-medium transition-colors disabled:opacity-60';

function ErrorBox({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border-schools-error text-schools-error bg-neutral-0 mb-4 rounded-[14px] border px-[16px] py-[10px] text-[12px] font-medium"
    >
      {message}
    </p>
  );
}

function EmailStep({ defaultEmail, onSent }: { defaultEmail: string; onSent: (email: string) => void }) {
  const requestOtp = useRequestTeacherOtp();
  const form = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: defaultEmail },
  });
  const error =
    form.formState.errors.email?.message ??
    (requestOtp.error ? userMessage(requestOtp.error, 'Failed to send code. Please try again.') : null);

  const submit = form.handleSubmit(({ email }) => {
    requestOtp.reset();
    requestOtp.mutate(email, { onSuccess: () => onSent(email) });
  });

  return (
    <form onSubmit={submit} noValidate>
      {error && <ErrorBox message={error} />}
      <h1 className="mt-1 mb-1 text-[32px] leading-[40px] font-medium text-neutral-900">Welcome back</h1>
      <p className="text-neutral-350 mb-6 text-[16px]">Enter the email linked to your student&apos;s Prepzy account.</p>
      <label
        htmlFor="schools-email"
        className="mb-[10px] block text-[11px] font-bold tracking-[1.5px] text-neutral-400 uppercase"
      >
        Email
      </label>
      <input
        id="schools-email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email address"
        aria-invalid={!!form.formState.errors.email}
        className="border-schools-line bg-neutral-0 focus:border-brand-700 mb-6 w-full rounded-sm border px-[20px] py-[20px] text-sm text-neutral-800 outline-none"
        {...form.register('email')}
      />
      <button type="submit" disabled={requestOtp.isPending} className={primaryButton}>
        {requestOtp.isPending ? 'Sending…' : 'Send verification code'}
      </button>
    </form>
  );
}

function OtpStep({ email, onBack }: { email: string; onBack: () => void }) {
  const verify = useVerifyTeacherOtp();
  const resend = useRequestTeacherOtp();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const form = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: '' },
  });
  const error =
    form.formState.errors.otp?.message ??
    (verify.error ? userMessage(verify.error, 'Invalid OTP. Please try again.') : null) ??
    (resend.error ? userMessage(resend.error, 'Failed to send code. Please try again.') : null);

  const submit = form.handleSubmit(({ otp }) => {
    verify.reset();
    verify.mutate(
      { email, otp },
      {
        onError: () => {
          form.setValue('otp', '');
          inputs.current[0]?.focus();
        },
      },
    );
  });

  return (
    <form onSubmit={submit} noValidate>
      {error && <ErrorBox message={error} />}
      <button
        type="button"
        onClick={onBack}
        className="text-neutral-350 mb-6 flex items-center gap-1 text-xs transition-colors hover:text-neutral-600"
      >
        ← Back
      </button>
      <h1 className="mt-1 mb-1 text-[32px] leading-[40px] font-medium text-neutral-900">Check your email</h1>
      <p className="text-neutral-350 mb-1 text-sm">We sent a 6-digit code to</p>
      <p className="mb-6 text-sm font-medium text-neutral-800">{email}</p>

      <Controller
        control={form.control}
        name="otp"
        render={({ field }) => {
          const digits = Array.from({ length: OTP_LENGTH }, (_, i) => (field.value[i] ?? '').trim());
          const setDigit = (index: number, value: string) => {
            const clean = value.replace(/\D/g, '');
            if (value && !clean) return;
            // Pasting a whole code fills every box.
            if (clean.length > 1) {
              field.onChange(clean.slice(0, OTP_LENGTH));
              inputs.current[Math.min(clean.length, OTP_LENGTH) - 1]?.focus();
              return;
            }
            const next = [...digits];
            next[index] = clean || ' ';
            // Empty boxes are kept as spaces so later digits stay in place; the schema rejects them.
            field.onChange(
              next
                .map((d) => d || ' ')
                .join('')
                .trimEnd(),
            );
            if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
          };
          return (
            <div className="mb-6 flex justify-between gap-2" role="group" aria-label="Verification code">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1}`}
                  value={digit}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                  }}
                  className="border-schools-line bg-neutral-0 focus:border-brand-700 focus:ring-brand-700/20 h-12 w-10 rounded-sm border text-center text-lg font-medium text-neutral-800 outline-none focus:ring-2"
                />
              ))}
            </div>
          );
        }}
      />

      <button type="submit" disabled={verify.isPending} className={`${primaryButton} mb-4`}>
        {verify.isPending ? 'Verifying…' : 'Verify & sign in'}
      </button>
      <p className="text-neutral-350 text-center text-xs">
        Didn&apos;t receive the code?{' '}
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => {
            verify.reset();
            resend.mutate(email, { onSuccess: () => toast.success('A new code is on its way.') });
          }}
          className="text-brand-700 underline underline-offset-2"
        >
          Resend
        </button>
      </p>
    </form>
  );
}

/** Teacher sign-in: email → 6-digit code sent by email → dashboard. */
export function SchoolsLogin() {
  const [email, setEmail] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState('');

  return (
    <div className="from-brand-700 to-schools-login-to h-dvh w-full bg-linear-to-r">
      <div className="mx-auto h-full max-w-[1440px]">
        <div className="flex h-full">
          <div className="hidden h-full w-1/2 flex-col p-10 md:flex">
            <div className="flex flex-col gap-[2px]">
              <Image
                src="/brand/logo-white.png"
                alt="Prepzy"
                width={100}
                height={34}
                priority
                className="h-auto w-[100px]"
              />
              <p className="text-neutral-0/70 text-[12px] font-medium">For Schools</p>
            </div>
            <div className="my-auto flex flex-col gap-8">
              <div>
                <h2 className="text-neutral-0 mb-2 text-[30px] leading-[36px] font-medium">
                  Stay connected to your child&apos;s learning journey
                </h2>
                <p className="text-neutral-0/70 text-[16px] leading-relaxed">
                  Everything you need to support your child&apos;s academic growth, in one place.
                </p>
              </div>
              <ul className="flex flex-col gap-[40px]">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <div
                      className="bg-neutral-0/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-neutral-0 mb-0.5 text-[18px] leading-[28px] font-medium">{f.title}</h3>
                      <p className="text-neutral-0/65 text-xs leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-center md:w-1/2">
            <div className="bg-neutral-0 flex h-[70%] w-full flex-1 flex-col justify-center rounded-[20px] px-[40px] pt-6 pb-4 lg:max-w-[600px] lg:px-[80px]">
              {email ? (
                <OtpStep email={email} onBack={() => setEmail(null)} />
              ) : (
                <EmailStep
                  defaultEmail={lastEmail}
                  onSent={(sent) => {
                    setLastEmail(sent);
                    setEmail(sent);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
