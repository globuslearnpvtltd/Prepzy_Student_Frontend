'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { partnerApi, partnerRoutes, type SignupInput } from '../api';
import { toNameChars, toTenDigits } from '../format';
import { firstError, signupSchema, type SignupValues } from '../schemas';
import {
  authCard,
  BrandPanel,
  ErrorBanner,
  errorText,
  fieldBox,
  fieldLabel,
  IndiaFlag,
  LegalNote,
  MobileBanner,
  MobileValueCards,
  PartnerLogo,
  PERKS,
  primaryButton,
} from './chrome';
import { SignupDetails } from './signup-details';
import { SignupSuccess } from './signup-success';
import { useCountdown } from './use-countdown';
import { VerifyOtp } from './verify-otp';

/** name + phone → OTP → partner type, email, city → done. */
type Step = 'details' | 'otp' | 'profile' | 'done';

const HEADING = (
  <>
    Earn when students
    <br />
    join Prepzy.
  </>
);
const SUBTITLE = 'Share one link for every exam. Earn ₹50 per sign-up, plus a share of every plan.';
const ORDER = ['firstName', 'lastName', 'phone'] as const;
const nameInput =
  'w-full min-w-0 bg-transparent px-[20px] py-[10px] text-[16px] leading-[normal] text-partner-ink outline-none placeholder:text-partner-placeholder lg:px-[18px] lg:text-[16px] lg:leading-[30px]';

/** Becoming a partner: the multi-step sign-up of the previous app. */
export function PartnerSignup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [serverError, setServerError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const countdown = useCountdown();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  });
  const sending = form.formState.isSubmitting;
  const input = (): SignupInput => {
    const { firstName, lastName, phone } = form.getValues();
    return { firstName: firstName.trim(), lastName: lastName.trim(), phone };
  };

  const sendOtp = form.handleSubmit(async () => {
    setServerError('');
    try {
      await partnerApi.sendSignupOtp(input());
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
      await partnerApi.verifySignupOtp(input(), code);
      setStep('profile');
      return true;
    } catch (error) {
      setServerError(errorText(error, 'Invalid OTP. Please try again.'));
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const restart = () => {
    setStep('details');
    setServerError('');
  };

  if (step === 'otp') {
    return (
      <div className="font-partner bg-partner-warm lg:bg-partner-page flex min-h-screen w-full lg:h-screen lg:overflow-hidden">
        <VerifyOtp
          phone={form.getValues('phone')}
          error={serverError}
          verifying={verifying}
          sending={sending}
          resendTimer={countdown.seconds}
          onBack={restart}
          onResend={() => void sendOtp()}
          onVerify={verify}
        />
      </div>
    );
  }

  if (step === 'profile') {
    return (
      <div className="font-partner bg-partner-warm lg:bg-partner-page flex min-h-screen w-full">
        {/* The OTP is spent, so Back starts over. The account stays pending until this step is saved, so its
            session is dropped too — otherwise the portal would open a dashboard with no profile to load. */}
        <SignupDetails
          onBack={() => {
            void partnerApi.logout().catch(() => undefined);
            restart();
          }}
          onDone={() => setStep('done')}
        />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="font-partner bg-partner-page flex min-h-screen w-full lg:h-screen lg:overflow-hidden">
        <SignupSuccess onGoToDashboard={() => router.push(partnerRoutes.dashboard)} />
      </div>
    );
  }

  const error = serverError || firstError(form.formState.errors, ORDER);
  return (
    <div className="font-partner bg-partner-warm lg:bg-partner-page flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <MobileBanner label="Step 1 of 2" heading={HEADING} subtitle={SUBTITLE} />
      <BrandPanel heading={HEADING} subtitle={SUBTITLE} fitScreen />

      <main className="relative -mt-[32px] flex min-w-0 flex-1 flex-col items-center gap-[28px] px-[24px] pb-[32px] lg:mt-0 lg:h-full lg:flex-row lg:justify-center lg:px-[16px] lg:pt-[96px] lg:pb-[24px]">
        {/* An empty flex item, as before: with the gap it nudges the card right of centre. */}
        <div className="hidden lg:block">
          <PartnerLogo />
        </div>

        {/* Short laptop screens get tighter spacing so the card still fits without scrolling. */}
        <form
          onSubmit={sendOtp}
          noValidate
          className={`${authCard} [@media(min-width:1024px)_and_(max-height:780px)]:gap-[12px] [@media(min-width:1024px)_and_(max-height:780px)]:p-[26px]`}
        >
          <ErrorBanner message={error} />
          <h2 className="font-display text-partner-ink m-0 hidden text-[28px] leading-[normal] font-semibold lg:block">Become a partner</h2>
          <p className="text-partner-muted m-0 hidden text-[16px] leading-[normal] lg:block">
            Tell us who you are. We will send a one-time code on WhatsApp.
          </p>
          <p className="text-partner-muted m-0 -mb-[6px] hidden text-[13.5px] leading-[normal] lg:block">
            Use your name as it appears on your bank account.
          </p>

          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 sm:gap-[12px]">
            {(
              [
                ['firstName', 'partner-first-name', 'First name', 'given-name'],
                ['lastName', 'partner-last-name', 'Last name', 'family-name'],
              ] as const
            ).map(([name, id, label, autoComplete]) => (
              <div key={name} className="flex min-w-0 flex-col gap-[16px] lg:gap-[18px]">
                <label htmlFor={id} className={fieldLabel}>
                  {label}
                </label>
                <div className={fieldBox}>
                  <Controller
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <input
                        id={id}
                        type="text"
                        autoComplete={autoComplete}
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(event) => field.onChange(toNameChars(event.target.value))}
                        placeholder={label}
                        className={nameInput}
                      />
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <label htmlFor="partner-phone" className={fieldLabel}>
            Mobile number
          </label>
          <div className={fieldBox}>
            <span className="font-display text-partner-ink flex shrink-0 items-center gap-[8px] py-[10px] pr-[12px] pl-[16px] text-[19px] leading-[normal] font-bold lg:py-[12px] lg:pr-[14px] lg:pl-[18px] lg:text-[20px]">
              <span className="lg:hidden">
                <IndiaFlag />
              </span>
              +91
            </span>
            <span className="bg-partner-input-line h-[32px] w-[1.4px] shrink-0 lg:h-[34px]" />
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <input
                  id="partner-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(toTenDigits(event.target.value))}
                  placeholder="Enter your number"
                  className="text-partner-ink placeholder:text-partner-placeholder min-w-0 flex-1 bg-transparent p-[16px] text-[16px] leading-[normal] outline-none lg:px-[18px] lg:py-[10px] lg:text-[16px]"
                />
              )}
            />
          </div>

          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? 'Sending…' : 'Get OTP on WhatsApp'}
          </button>

          <p className="m-0 flex items-center justify-center gap-[5px] text-[15px] leading-[normal] whitespace-nowrap lg:gap-[6px] lg:text-[14px]">
            <span className="text-partner-muted">Already a partner?</span>
            <Link href={partnerRoutes.login} className="text-brand-700 font-bold no-underline hover:underline">
              Sign in
            </Link>
          </p>
          <LegalNote />
        </form>

        <MobileValueCards items={PERKS} />
      </main>
    </div>
  );
}
