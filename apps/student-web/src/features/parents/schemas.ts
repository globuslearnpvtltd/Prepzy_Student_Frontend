import { z } from 'zod';
import { COUNTRY_DIAL_CODES } from '@/features/auth';

/** Parents login form schemas (imported only by the login screen, so zod stays out of other pages). */

export const emailFormSchema = z.object({
  email: z.string().trim().min(1, 'Add Valid Credentials').email('Enter a valid email address'),
});

/** Country + national number → "+<dial><digits>". The backend accepts any country (WhatsApp delivery). */
export const whatsappFormSchema = z
  .object({
    country: z.string(),
    // Same rule as the previous app: at least 6 digits after the dial code.
    phone: z.string().refine((value) => /^\d{6,14}$/.test(value.replace(/\D/g, '')), 'Add Valid Credentials'),
  })
  .transform(({ country, phone }) => `+${COUNTRY_DIAL_CODES[country] ?? '91'}${phone.replace(/\D/g, '')}`);

export const otpFormSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
