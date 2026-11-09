'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { cx } from '@prepzy/design-system';
import { PORTALS } from '@/shared/config/portals';
import { userMessage } from '@/shared/lib/errors';
import { parentsApi, type OtpChannel } from '../api';
import { emailFormSchema, otpFormSchema, whatsappFormSchema } from '../schemas';
import { CountryPhoneInput } from './phone-input';

type Step = 'email' | 'whatsapp' | 'otp';

/** Same storage key as the previous app, so a running resend countdown survives a reload. */
const RESEND_KEY = 'otp_resend_until';
const RESEND_SECONDS = 120;
const OTP_LENGTH = 6;
const EMPTY_OTP = Array<string>(OTP_LENGTH).fill('');

const FEATURES = [
  { title: 'Real-time progress tracking', desc: 'Monitor scores and performance across all subjects instantly.' },
  {
    title: 'Learning Hours Tracking',
    desc: 'Will get detailed overview on how much time student used Prepzy Application.',
  },
  {
    title: 'Doubt Clarification Status',
    desc: 'Provides analysis on how many doubts get cleared from Prepzy 24/7 Teacher.',
  },
  {
    title: 'Strengths And Weakness Analytics with Leaderboards',
    desc: 'Instant insights on students status among other students and Weak Areas',
  },
];

function readResendUntil(): number {
  try {
    return Number(localStorage.getItem(RESEND_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function writeResendUntil(until: number | null) {
  try {
    if (until) localStorage.setItem(RESEND_KEY, String(until));
    else localStorage.removeItem(RESEND_KEY);
  } catch {
    // Private mode: the countdown just won't survive a reload.
  }
}

/** Seconds left before "Resend" is offered again (ticks every second, persisted across reloads). */
function useResendTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const remaining = Math.ceil((readResendUntil() - Date.now()) / 1000);
    if (remaining > 0) setSeconds(remaining);
  }, []);
  useEffect(() => {
    if (seconds <= 0) {
      writeResendUntil(null);
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const start = () => {
    writeResendUntil(Date.now() + RESEND_SECONDS * 1000);
    setSeconds(RESEND_SECONDS);
  };
  return { seconds, start };
}

/** A message that disappears after `ms` (like the previous app's banners). */
function useFlash(ms: number) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), ms);
    return () => clearTimeout(timer);
  }, [message, ms]);
  return [message, setMessage] as const;
}

const primaryButton = 'text-neutral-0 mb-4 w-full rounded-[8px] py-[16px] text-[16px] font-medium disabled:opacity-60';
const switchButton =
  'border-schools-line hover:bg-schools-faint flex w-full items-center justify-center gap-2 rounded-[8px] border py-[16px] text-[14px]/[20px] font-medium transition-colors';
const heading = 'text-neutral-950 mt-1 mb-1 text-[32px]/[40px] font-medium';
const fieldLabel = 'text-neutral-400 mb-[10px] block text-[11px]/[16px] font-bold tracking-[1.5px] uppercase';

function Divider() {
  return (
    <div className="my-2 flex items-center gap-3">
      <div className="bg-neutral-100 h-px flex-1" />
      <span className="text-neutral-350 text-xs">or</span>
      <div className="bg-neutral-100 h-px flex-1" />
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden className="fill-success-350 size-5" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden className="text-brand-700 size-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="hidden h-full w-1/2 flex-col p-10 md:flex">
      <Link href={PORTALS.parents.basePath} className="flex w-fit flex-col gap-[2px]">
        <Image src="/brand/logo-white.png" alt="Prepzy" width={108} height={36} priority className="h-9 w-auto" />
        <span className="text-neutral-0/70 text-[12px]/[16px] font-medium">For Parents</span>
      </Link>
      <div className="my-auto flex flex-col gap-8">
        <div>
          <h2 className="text-neutral-0 mb-2 text-[30px]/[36px] font-medium">
            Stay connected to your child&apos;s learning journey
          </h2>
          <p className="text-neutral-0/70 text-[16px]/[26px]">
            Everything you need to support your child&apos;s academic growth, in one place.
          </p>
        </div>
        <ul className="flex flex-col gap-[40px]">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <span aria-hidden className="bg-neutral-0/15 flex size-9 shrink-0 rounded-[8px]" />
              <div>
                <h3 className="text-neutral-0 mb-0.5 text-[18px]/[28px] font-medium">{f.title}</h3>
                <p className="text-neutral-0/65 text-xs/[19.5px]">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SwitchButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={switchButton}>
      {icon}
      <span className="text-neutral-600">{children}</span>
    </button>
  );
}

/** Parents sign-in: email or WhatsApp OTP, then a 6-digit code. Ported from the previous app's /parents-login. */
export function ParentLoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [channel, setChannel] = useState<OtpChannel | null>(null);
  const [digits, setDigits] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useFlash(5000);
  const [success, setSuccess] = useFlash(4000);
  const resend = useResendTimer();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const emailForm = useForm<z.input<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  });
  const phoneForm = useForm<z.input<typeof whatsappFormSchema>, unknown, z.output<typeof whatsappFormSchema>>({
    resolver: zodResolver(whatsappFormSchema),
    defaultValues: { country: 'IN', phone: '' },
  });
  const otpForm = useForm<z.input<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: '' },
  });

  const requestOtp = useMutation({
    mutationFn: parentsApi.requestOtp,
    onMutate: () => setError(''),
    onSuccess: (_, sent) => {
      setChannel(sent);
      setStep('otp');
      resend.start();
      setSuccess(`OTP sent successfully via ${sent.method === 'whatsapp' ? 'WhatsApp' : 'email'}`);
    },
    onError: (e) => setError(userMessage(e, 'Login failed. Please try again.')),
  });

  const verifyOtp = useMutation({
    mutationFn: ({ contact, otp }: { contact: string; otp: string }) => parentsApi.verifyOtp(contact, otp),
    onMutate: () => setError(''),
    onSuccess: () => router.replace(PORTALS.parents.home),
    onError: (e) => {
      setError(userMessage(e, 'Invalid OTP. Please try again.'));
      setOtp(EMPTY_OTP);
    },
  });

  const setOtp = (next: string[]) => {
    setDigits(next);
    otpForm.setValue('otp', next.join(''));
  };

  const formError = (message: string | undefined) => message && setError(message);

  const sendEmail = emailForm.handleSubmit(
    ({ email }) => requestOtp.mutate({ method: 'email', email: email.trim() }),
    (errors) => formError(errors.email?.message),
  );
  const sendWhatsApp = phoneForm.handleSubmit(
    (phone) => requestOtp.mutate({ method: 'whatsapp', phone }),
    (errors) => formError(errors.phone?.message),
  );
  const verify = otpForm.handleSubmit(
    ({ otp }) => channel && verifyOtp.mutate({ contact: channel.method === 'email' ? channel.email : channel.phone, otp }),
    (errors) => formError(errors.otp?.message),
  );

  const changeDigit = (value: string, index: number) => {
    setError('');
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) boxes.current[index + 1]?.focus();
  };

  const keyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
  };

  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').split('');
    if (pasted.length === 0) return;
    setOtp(EMPTY_OTP.map((_, i) => pasted[i] ?? ''));
    boxes.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
    setOtp(EMPTY_OTP);
  };

  const viaWhatsApp = channel?.method === 'whatsapp';

  return (
    <div className="font-plain from-brand-700 to-schools-login-to h-screen w-full bg-linear-to-r">
      <div className="mx-auto h-full max-w-[1440px]">
        <div className="flex h-full">
          <BrandPanel />
          <div className="flex h-full w-full items-center justify-center md:w-1/2">
            <div className="bg-surface flex h-[70%] w-full flex-1 flex-col justify-center rounded-[20px] px-[40px] pt-6 pb-4 lg:max-w-[600px] lg:px-[80px]">
              {success && <p className="text-success-700 mt-2 text-[14px]/[20px]">{success}</p>}
              {error && (
                <p
                  role="alert"
                  className="bg-surface border-schools-error text-schools-error rounded-[14px] border px-[16px] py-[10px] font-sans text-[12px] font-medium"
                >
                  {error}
                </p>
              )}

              {step === 'email' && (
                <form noValidate onSubmit={sendEmail}>
                  <h1 className={heading}>Welcome back</h1>
                  <p className="text-neutral-700 mb-6 text-[16px]/[24px]">
                    Enter the email linked to your child&apos;s Prepzy account.
                  </p>
                  <label htmlFor="parent-email" className={fieldLabel}>
                    Email
                  </label>
                  <input
                    id="parent-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    className="border-schools-line focus:border-brand-700 bg-surface text-plan-cbse placeholder:text-neutral-350 mb-6 w-full rounded-[8px] border p-[20px] text-[14px]/[20px] outline-none"
                    {...emailForm.register('email')}
                  />
                  <button type="submit" disabled={requestOtp.isPending} className={cx(primaryButton, 'bg-brand-700')}>
                    Send verification code
                  </button>
                  <Divider />
                  <SwitchButton onClick={() => goTo('whatsapp')} icon={<WhatsAppIcon />}>
                    Continue with WhatsApp instead
                  </SwitchButton>
                </form>
              )}

              {step === 'whatsapp' && (
                <form noValidate onSubmit={sendWhatsApp}>
                  <h1 className={heading}>Welcome back</h1>
                  <p className="text-neutral-350 mb-6 text-[16px]/[24px]">
                    Enter your WhatsApp number to receive a login code.
                  </p>
                  <label htmlFor="parent-phone" className={fieldLabel}>
                    WhatsApp number
                  </label>
                  <CountryPhoneInput
                    id="parent-phone"
                    country={phoneForm.watch('country')}
                    onCountryChange={(iso) => {
                      phoneForm.setValue('country', iso);
                      setError('');
                    }}
                    registration={phoneForm.register('phone', { onChange: () => setError('') })}
                  />
                  <button type="submit" disabled={requestOtp.isPending} className={cx(primaryButton, 'bg-success-350')}>
                    Send code on WhatsApp
                  </button>
                  <Divider />
                  <SwitchButton onClick={() => goTo('email')} icon={<MailIcon />}>
                    Continue with Email instead
                  </SwitchButton>
                </form>
              )}

              {step === 'otp' && channel && (
                <form noValidate onSubmit={verify}>
                  <button
                    type="button"
                    onClick={() => goTo(channel.method)}
                    className="text-neutral-350 hover:text-neutral-600 mb-6 flex items-center gap-1 text-xs transition-colors"
                  >
                    ← Back
                  </button>
                  <h1 className={heading}>Check your {viaWhatsApp ? 'WhatsApp' : 'email'}</h1>
                  <p className="text-neutral-350 mb-1 text-[14px]/[20px]">We sent a 6-digit code to</p>
                  <p className="text-plan-cbse mb-6 text-[14px]/[20px] font-medium">
                    {channel.method === 'email' ? channel.email : channel.phone}
                  </p>
                  <div className="mb-6 flex justify-between gap-2" role="group" aria-label="Verification code">
                    {digits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          boxes.current[i] = el;
                        }}
                        aria-label={`Digit ${i + 1}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => changeDigit(e.target.value, i)}
                        onKeyDown={(e) => keyDown(e, i)}
                        onPaste={paste}
                        className="border-schools-line bg-surface text-plan-cbse focus:border-brand-700 focus:ring-brand-700/20 h-12 w-10 rounded-[8px] border text-center text-lg font-medium outline-none focus:ring-2"
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={verifyOtp.isPending}
                    className={cx(primaryButton, viaWhatsApp ? 'bg-success-350' : 'bg-brand-700')}
                  >
                    Verify &amp; sign in
                  </button>
                  <p className="text-neutral-350 text-center text-xs">
                    Didn&apos;t receive the code?{' '}
                    {resend.seconds > 0 ? (
                      <span>
                        Resend in {Math.floor(resend.seconds / 60)}:{String(resend.seconds % 60).padStart(2, '0')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={requestOtp.isPending}
                        onClick={() => requestOtp.mutate(channel)}
                        className="text-brand-700 underline underline-offset-2"
                      >
                        Resend
                      </button>
                    )}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
