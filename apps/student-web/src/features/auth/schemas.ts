import { z } from 'zod';
import { COUNTRY_DIAL_CODES } from './countries';
import { isValidPhone, normalizePhone } from './model';

/** Form schemas (imported only by the auth forms, so zod stays out of other pages). */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter your phone number')
  .transform(normalizePhone)
  .refine(isValidPhone, { message: 'Enter a valid 10-digit mobile number' });

/** Country picker + national number → full international number (e.g. +919876543210). */
export const phoneFormSchema = z
  .object({ country: z.string(), phone: z.string().trim().min(1, 'Enter your mobile number') })
  .transform(({ country, phone }) => normalizePhone(`+${COUNTRY_DIAL_CODES[country] ?? '91'}${phone.replace(/\D/g, '')}`))
  .refine(isValidPhone, { message: 'Enter a valid mobile number', path: ['phone'] });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const otpFormSchema = z.object({ otp: otpSchema });
