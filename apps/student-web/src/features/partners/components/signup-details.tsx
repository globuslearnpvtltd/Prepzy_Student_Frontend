'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { partnerApi } from '../api';
import { usePartnerTypes } from '../hooks';
import { firstError, signupDetailsSchema, type SignupDetailsValues } from '../schemas';
import { BackLink, ErrorBanner, errorText, fieldLabel, InfoCards, MobileBanner, MobileValueCards, type InfoCard, type ValueItem } from './chrome';
import { CityStateInput } from './city-state-input';

const NEXT_STEPS: InfoCard[] = [
  { icon: 'icon-search-22.svg', title: 'We check your details', desc: 'Usually two working days' },
  { icon: 'icon-check-22.svg', title: 'Your account is activated', desc: 'Your Referral link is created' },
  { icon: 'icon-share-22.svg', title: 'Share your Referral link', desc: 'Via WhatsApp, or other social media' },
  { icon: 'icon-rupee-22.svg', title: 'Cash is Credited', desc: 'Once your referral sign-ups or purchases a plan' },
];

const ASSURANCES: ValueItem[] = [
  { icon: 'icon-lock.svg', label: 'Your details stay private', value: '✓' },
  { icon: 'icon-percent.svg', label: 'Used to set your rate', value: '✓' },
  { icon: 'icon-chat.svg', label: 'Link sent by WhatsApp', value: '✓' },
];

const fieldInput =
  'w-full min-w-0 rounded-[14px] border-[1.4px] border-solid border-partner-input-line bg-partner-input px-[20px] py-[19px] text-[16px] leading-[normal] text-partner-ink outline-none transition-colors placeholder:text-partner-placeholder focus:border-brand-700 lg:px-[18px] lg:py-[15px] lg:text-[18px]';
const ORDER = ['partnerTypeId', 'email', 'city'] as const;

/** Sign-up step 2 ("How to reach you"): partner type, email and city. */
export function SignupDetails({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const types = usePartnerTypes();
  const [serverError, setServerError] = useState('');
  const form = useForm<SignupDetailsValues>({
    resolver: zodResolver(signupDetailsSchema),
    defaultValues: { partnerTypeId: 0, email: '', city: '' },
  });
  const submitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError('');
    try {
      await partnerApi.submitSignupDetails(values);
      onDone();
    } catch (error) {
      setServerError(errorText(error, 'Could not save your details. Please try again.'));
    }
  });

  const typesError = types.isError ? errorText(types.error, 'Could not load partner types. Please refresh the page.') : '';
  const error = serverError || firstError(form.formState.errors, ORDER) || typesError;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <MobileBanner
        label="Step 2 of 2"
        heading="How to reach you"
        subtitle="We send your link here, and a short summary each month. None of it is public."
      />

      <main className="relative -mt-[32px] flex flex-col items-center gap-[36px] px-[24px] pb-[32px] lg:mt-0 lg:gap-[26px] lg:px-[16px] lg:pt-[42px] lg:pb-[48px]">
        <div className="hidden lg:contents">
          <BackLink onClick={onBack} />
        </div>

        <div className="hidden w-full max-w-[560px] flex-col items-center gap-[10px] text-center lg:flex">
          <h1 className="font-display text-partner-ink m-0 text-[32px] leading-[normal] font-extrabold sm:text-[40px]">How to reach you</h1>
          <p className="text-partner-muted m-0 text-[18px] leading-[26px]">
            We send your link here, and a short summary each month.
            <br />
            None of it is public.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="bg-neutral-0 lg:border-partner-line flex w-full max-w-[560px] flex-col items-start gap-[16px] rounded-[24px] p-[22px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.1)] lg:gap-[10px] lg:border-[1px] lg:border-solid lg:p-[34px] lg:shadow-none"
        >
          <ErrorBanner message={error} />

          <span id="partner-type-label" className={fieldLabel}>
            I am a
          </span>
          <Controller
            control={form.control}
            name="partnerTypeId"
            render={({ field }) => (
              <div role="radiogroup" aria-labelledby="partner-type-label" className="flex w-full flex-wrap gap-[8px]">
                {types.isPending && <span className="text-partner-placeholder py-[8px] text-[14px]">Loading…</span>}
                {types.data?.map((type) => {
                  const selected = type.id === field.value;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(type.id)}
                      className={`font-display rounded-full border-solid px-[14px] py-[9px] text-[15px] leading-[normal] font-bold whitespace-nowrap transition-colors lg:py-[8px] lg:text-[14px] ${
                        selected
                          ? 'border-brand-700 bg-partner-chip text-brand-700 border-[1.5px]'
                          : 'border-partner-chip-line bg-neutral-0 text-partner-chip-text hover:border-brand-700 border-[1px]'
                      }`}
                    >
                      {type.name}
                    </button>
                  );
                })}
              </div>
            )}
          />

          <label htmlFor="partner-email" className={fieldLabel}>
            Email{' '}
            <span aria-hidden="true" className="text-danger-450">
              *
            </span>
          </label>
          <input
            id="partner-email"
            type="email"
            autoComplete="email"
            aria-required="true"
            placeholder="you@example.com"
            className={fieldInput}
            {...form.register('email')}
          />

          <label htmlFor="partner-city" className={fieldLabel}>
            City and state{' '}
            <span aria-hidden="true" className="text-danger-450">
              *
            </span>
          </label>
          <Controller
            control={form.control}
            name="city"
            render={({ field }) => (
              <CityStateInput
                id="partner-city"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Start typing your city"
                className={fieldInput}
              />
            )}
          />

          <button
            type="submit"
            disabled={submitting}
            className="font-display bg-brand-700 text-neutral-0 hover:bg-partner-hover flex w-full items-center justify-center rounded-[15px] py-[18px] text-[19px] leading-[normal] font-bold shadow-[0px_8px_18px_0px_rgba(61,52,139,0.3)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-[14px] lg:shadow-none"
          >
            {submitting ? 'Submitting…' : 'Submit details'}
          </button>
        </form>

        <div className="hidden lg:contents">
          <InfoCards heading="What happens next" cards={NEXT_STEPS} />
        </div>
        <MobileValueCards items={ASSURANCES} />
      </main>
    </div>
  );
}
