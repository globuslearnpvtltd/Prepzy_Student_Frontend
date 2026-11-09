import { z } from 'zod';

/** Same rules as the previous partner portal. */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const phone = z.string().regex(/^\d{10}$/, 'Please enter a valid 10-digit mobile number.');

export const loginSchema = z.object({ phone });
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name.'),
  lastName: z.string().trim(),
  phone,
});
export type SignupValues = z.infer<typeof signupSchema>;

export const signupDetailsSchema = z.object({
  partnerTypeId: z.number().int().min(1, 'Please choose what describes you best.'),
  email: z.string().trim().regex(EMAIL_REGEX, 'Please enter a valid email address.'),
  city: z.string().trim().min(1, 'Please enter your city and state.'),
});
export type SignupDetailsValues = z.infer<typeof signupDetailsSchema>;

export const bankDetailsSchema = z.object({
  accountHolderName: z.string().trim().min(1, 'Full legal name is required'),
  bankAccountNumber: z.string().trim().regex(ACCOUNT_NUMBER_REGEX, 'Enter a valid account number (9-18 digits)'),
  ifscCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(IFSC_REGEX, 'Enter a valid IFSC code')),
  pan: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(PAN_REGEX, 'Enter a valid PAN (e.g. ABCPV1234X)')),
});
export type BankDetailsFormValues = z.input<typeof bankDetailsSchema>;
export type BankDetailsValues = z.output<typeof bankDetailsSchema>;

/** Amount between the minimum payout and the available balance. */
export function payoutSchema(minimum: number, balance: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .min(1, 'Enter an amount')
      .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Enter a valid amount')
      .refine((value) => Number(value) >= minimum, `The minimum payout is ₹${minimum}`)
      .refine((value) => Number(value) <= balance, 'That is more than your available balance'),
  });
}
export type PayoutValues = { amount: string };

/** First message among a form's errors, in field order — the auth cards show one banner, like before. */
export function firstError(errors: Partial<Record<string, { message?: string } | undefined>>, order: readonly string[]) {
  for (const key of order) {
    const message = errors[key]?.message;
    if (message) return message;
  }
  return '';
}
