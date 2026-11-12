'use client';

import { FieldError } from '@prepzy/design-system';
import { useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { COUNTRY_DIAL_CODES } from '../countries';

const flagOf = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

/** Mobile number with a country picker (flag + dial code), styled like the original login. */
export function PhoneField({
  country,
  onCountryChange,
  registration,
  error,
  labelClassName = 'text-foreground-subtle',
}: {
  country: string;
  onCountryChange: (iso: string) => void;
  registration: UseFormRegisterReturn;
  error?: string;
  /** Label colour (the original sign-up used a darker grey than login). */
  labelClassName?: string;
}) {
  const countries = useMemo(() => {
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    return Object.entries(COUNTRY_DIAL_CODES)
      .map(([iso, dial]) => ({ iso, dial, name: names?.of(iso) ?? iso }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const dial = COUNTRY_DIAL_CODES[country] ?? '91';

  return (
    <div className="flex flex-col">
      <label
        htmlFor="phone"
        className={`mb-2.5 text-[10px] font-bold tracking-[1.5px] uppercase lg:text-[11px] ${labelClassName}`}
      >
        Mobile number
      </label>
      <div
        className={`bg-surface relative mb-2.5 flex h-[64px] items-stretch rounded-lg border-2 transition-[box-shadow,border-color] focus-within:ring-4 focus-within:ring-brand/10 lg:h-[68px] ${
          error ? 'border-onboarding-error shadow-onboarding-field-error' : 'border-brand shadow-onboarding-field'
        }`}
      >
        <span className="border-line relative flex w-[72px] shrink-0 items-center justify-center gap-1 border-r-[1.5px]">
          <span aria-hidden className="text-[22px] leading-none">
            {flagOf(country)}
          </span>
          <svg aria-hidden viewBox="0 0 10 6" width="8" height="5" className="fill-foreground-soft mt-px shrink-0">
            <path d="M0 0l5 6 5-6z" />
          </svg>
          {/* Native select over the flag: accessible, searchable by typing, and tiny. */}
          <select
            aria-label="Country code"
            value={country}
            onChange={(e) => onCountryChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {countries.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </span>
        <span
          aria-hidden
          className="text-ink flex items-center pl-3 text-[18px] font-bold tracking-[0.5px] lg:text-[20px]"
        >
          +{dial}
        </span>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={!!error}
          aria-describedby={error ? 'phone-error' : undefined}
          className="text-ink min-w-0 flex-1 rounded-r-lg bg-transparent pr-4 pl-1.5 text-[18px] font-bold tracking-[0.5px] outline-none lg:text-[20px]"
          {...registration}
        />
      </div>
      <FieldError id="phone-error" className="font-plain text-onboarding-error mt-0 mb-2 text-[13px] font-semibold">
        {error}
      </FieldError>
    </div>
  );
}
