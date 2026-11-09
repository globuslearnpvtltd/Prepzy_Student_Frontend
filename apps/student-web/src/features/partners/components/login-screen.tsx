'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { partnerApi, partnerRoutes } from '../api';
import { toTenDigits } from '../format';
import { loginSchema, type LoginValues } from '../schemas';
import {
  authCard,
  BrandPanel,
  ErrorBanner,
  errorText,
  fieldBox,
  fieldLabel,
  LegalNote,
  MobileBanner,
  MobileValueCards,
  PartnerLogo,
  PERKS,
  primaryButton,
} from './chrome';
import { useCountdown } from './use-countdown';
import { VerifyOtp } from './verify-otp';

const SUBTITLE = 'Sign in to see your referrals, your balance and your payouts.';

/** Partner sign-in: mobile number → WhatsApp OTP → dashboard. */
export function PartnerLogin() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [serverError, setServerError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const countdown = useCountdown();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { phone: '' } });
  const sending = form.formState.isSubmitting;
  const phone = form.watch('phone');

  const sendOtp = form.handleSubmit(async ({ phone: number }) => {
    setServerError('');
    try {
      await partnerApi.sendLoginOtp(number);
      setStep('otp');
      countdown.start();
    } catch (error) {
      setServerError(errorText(error, 'Failed to send OTP. Please try again.'));
    }
  });

  const verify = async (code: string) => {
    setServerError('');
    setVerifying(true);
    try {
      await partnerApi.verifyLoginOtp(phone, code);
      router.push(partnerRoutes.dashboard);
      return true;
    } catch (error) {
      setServerError(errorText(error, 'Invalid OTP. Please try again.'));
      return false;
    } finally {
      setVerifying(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="font-partner bg-partner-warm lg:bg-partner-page flex min-h-screen w-full lg:h-screen lg:overflow-hidden">
        <VerifyOtp
          mode="login"
          phone={phone}
          error={serverError}
          verifying={verifying}
          sending={sending}
          resendTimer={countdown.seconds}
          onBack={() => {
            setStep('phone');
            setServerError('');
          }}
          onResend={() => void sendOtp()}
          onVerify={verify}
        />
      </div>
    );
  }

  const error = serverError || form.formState.errors.phone?.message || '';
  return (
    <div className="font-partner bg-partner-warm lg:bg-partner-page flex min-h-screen w-full flex-col lg:flex-row">
      <MobileBanner label="Partners" heading="Welcome back." subtitle={SUBTITLE} />
      <BrandPanel heading="Welcome back." subtitle={SUBTITLE} />

      <main className="relative -mt-[32px] flex min-w-0 flex-1 flex-col items-center gap-[28px] px-[24px] pb-[32px] lg:mt-0 lg:flex-row lg:justify-center lg:px-[16px] lg:py-[104px]">
        {/* An empty flex item, as before: with the gap it nudges the card right of centre. */}
        <div className="hidden lg:block">
          <PartnerLogo />
        </div>

        <form onSubmit={sendOtp} noValidate className={authCard}>
          <ErrorBanner message={error} />
          <h2 className="font-display text-partner-ink m-0 hidden text-[28px] leading-[normal] font-semibold lg:block">
            Partner sign in
          </h2>
          <p className="text-partner-muted m-0 hidden text-[16px] leading-[normal] lg:block">
            We will send a one-time code on WhatsApp.
          </p>

          <label htmlFor="partner-login-phone" className={fieldLabel}>
            Mobile number
          </label>
          <div className={fieldBox}>
            <span className="flex shrink-0 items-center gap-[8px] py-[16px] pr-[12px] pl-[16px] lg:gap-[9px] lg:py-[17px] lg:pr-[14px] lg:pl-[18px]">
              <span className="font-display text-partner-ink text-[19px] leading-[normal] font-bold lg:text-[20px]">+91</span>
            </span>
            <span className="bg-partner-input-line h-[32px] w-[1.4px] shrink-0 lg:h-[34px]" />
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <input
                  id="partner-login-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(toTenDigits(event.target.value))}
                  placeholder="Enter your number"
                  className="text-partner-ink placeholder:text-partner-placeholder min-w-0 flex-1 bg-transparent p-[16px] text-[16px] leading-[normal] outline-none lg:px-[18px] lg:py-[15px] lg:text-[16px]"
                />
              )}
            />
          </div>

          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? 'Sending…' : 'Get OTP on WhatsApp'}
          </button>

          <p className="m-0 flex items-center justify-center gap-[5px] text-[15px] leading-[normal] whitespace-nowrap lg:gap-[6px] lg:text-[16px]">
            <span className="text-partner-muted">New partner?</span>
            <Link href={partnerRoutes.signup} className="text-brand-700 font-bold no-underline hover:underline">
              Become a partner
            </Link>
          </p>
          <LegalNote />
        </form>

        <MobileValueCards items={PERKS} />
      </main>
    </div>
  );
}
