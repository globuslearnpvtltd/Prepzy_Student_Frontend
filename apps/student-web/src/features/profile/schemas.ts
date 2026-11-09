import { z } from 'zod';

/** Form schemas (imported only by the profile forms, so zod stays out of other pages). */
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Name is required'),
  lastName: z.string().trim().min(1, 'Last Name is required'),
  email: z.union([z.literal(''), z.string().trim().email('Please enter a valid email address')]),
  dateOfBirth: z.string(),
  address: z.string(),
  city: z.string(),
  gender: z.enum(['', 'male', 'female', 'other']),
  classId: z.string().min(1, 'Please select a class'),
  school: z.string(),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Enter your old password'),
    newPassword: z.string().min(1, 'Enter a new password'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword.trim() === v.confirmPassword.trim(), {
    message: 'Password Should Be Same',
    path: ['confirmPassword'],
  });

export const parentSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    contactMethod: z.enum(['whatsapp', 'email']),
    dialCode: z.string(),
    contact: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.contactMethod === 'email') {
      if (!v.contact) ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Email is required' });
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact))
        ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Enter a valid email address' });
      return;
    }
    const local = v.contact.replace(/\D/g, '');
    const total = v.dialCode.replace(/\D/g, '').length + local.length;
    if (!local) ctx.addIssue({ code: 'custom', path: ['contact'], message: 'WhatsApp number is required' });
    else if (local.length < 6 || total > 15)
      ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Enter a valid phone number' });
  });

export const parentOtpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
