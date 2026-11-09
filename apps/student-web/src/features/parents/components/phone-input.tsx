'use client';

import { useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { COUNTRY_DIAL_CODES } from '@/features/auth';

const flagOf = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

/** WhatsApp number with a country picker, styled like the previous app's react-phone-input-2 field (60px tall). */
export function CountryPhoneInput({
  id,
  country,
  onCountryChange,
  registration,
}: {
  id: string;
  country: string;
  onCountryChange: (iso: string) => void;
  registration: UseFormRegisterReturn;
}) {
  const countries = useMemo(() => {
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    return Object.entries(COUNTRY_DIAL_CODES)
      .map(([iso, dial]) => ({ iso, dial, name: names?.of(iso) ?? iso }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const dial = COUNTRY_DIAL_CODES[country] ?? '91';

  return (
    <div className="border-schools-line bg-surface focus-within:border-success-350 relative mb-6 flex h-[60px] w-full items-center rounded-[8px] border transition-colors">
      <div className="relative flex h-full w-[80px] shrink-0 items-center gap-1.5 pl-4">
        <span aria-hidden className="text-[20px] leading-none">
          {flagOf(country)}
        </span>
        <svg aria-hidden viewBox="0 0 10 6" width="7" height="4" className="fill-neutral-350">
          <path d="M0 0l5 6 5-6z" />
        </svg>
        <span aria-hidden className="bg-schools-line absolute top-3 right-0 bottom-3 w-px" />
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
      </div>
      <span aria-hidden className="text-plan-cbse pl-3 text-[14px]">
        +{dial}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="text-plan-cbse placeholder:text-neutral-350 h-full min-w-0 flex-1 rounded-r-[8px] bg-transparent pr-5 pl-1 text-[14px] outline-none"
        {...registration}
      />
    </div>
  );
}
