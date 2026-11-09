import { z } from 'zod';

/** Teacher login forms (imported only by the login screen, so zod stays out of other pages). */
export const emailFormSchema = z.object({
  email: z.string().trim().min(1, 'Please enter a valid email address.').email('Please enter a valid email address.'),
});

export const otpFormSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});
