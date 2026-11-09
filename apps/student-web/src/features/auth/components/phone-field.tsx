'use client';

import { FieldError, InputGroup, InputGroupInput, InputGroupPrefix } from '@prepzy/design-system';
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
}: {
  country: string;
  onCountryChange: (iso: string) => void;
  registration: UseFormRegisterReturn;
  error?: string;
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
        className="text-foreground-subtle mb-2.5 text-[10px] font-bold tracking-[1.5px] uppercase lg:text-[11px]"
      >
        Mobile number
      </label>
      <InputGroup invalid={!!error}>
        <InputGroupPrefix className="w-[72px] justify-center">
          <span aria-hidden className="text-[22px] leading-none">
            {flagOf(country)}
          </span>
          <svg aria-hidden viewBox="0 0 10 6" width="8" height="5" className="fill-foreground-soft">
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
        </InputGroupPrefix>
        <span aria-hidden className="text-ink flex items-center pl-3 text-lg font-bold">
          +{dial}
        </span>
        <InputGroupInput
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          aria-invalid={!!error}
          aria-describedby={error ? 'phone-error' : undefined}
          {...registration}
        />
      </InputGroup>
      <FieldError id="phone-error" className="mt-2 font-semibold">
        {error}
      </FieldError>
    </div>
  );
}
