'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cx } from '@prepzy/design-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Mail, MessageCircle, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { userMessage } from '@/shared/lib/errors';
import { profileApi, type ContactMethod, type Parent, type ParentDetails } from '../api';
import { profileKeys, useParent } from '../hooks';
import { parentOtpSchema, parentSchema } from '../schemas';
import { inputClass, SolidButton } from './kit';

type Values = z.input<typeof parentSchema>;
type Mode = 'view' | 'add' | 'edit';
type Step = 'details' | 'otp' | 'success';

const digits = (value: string) => value.replace(/\D/g, '');

/** WhatsApp numbers go out as +<country><number>; emails as typed. */
export function toParentDetails(values: Values): ParentDetails {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    contactMethod: values.contactMethod,
    contactValue:
      values.contactMethod === 'whatsapp' ? `+${digits(values.dialCode)}${digits(values.contact)}` : values.contact.trim(),
  };
}

/** Same contact as the linked parent → only the name changed, no OTP needed. */
export function sameContact(parent: Parent | null | undefined, details: ParentDetails): boolean {
  if (!parent || parent.contactMethod !== details.contactMethod) return false;
  return details.contactMethod === 'whatsapp'
    ? digits(parent.contactValue) === digits(details.contactValue)
    : parent.contactValue.trim().toLowerCase() === details.contactValue.trim().toLowerCase();
}

function MethodIcon({ method, active = true }: { method: ContactMethod; active?: boolean }) {
  const Icon = method === 'whatsapp' ? MessageCircle : Mail;
  return (
    <Icon
      aria-hidden
      className={cx('size-4', !active ? 'text-neutral-350' : method === 'whatsapp' ? 'text-success-350' : 'text-info-400')}
    />
  );
}

const methodLabel = (method: ContactMethod) => (method === 'whatsapp' ? 'WhatsApp' : 'Email');

function splitPhone(value: string): { dialCode: string; contact: string } {
  const all = digits(value);
  if (all.length > 10) return { dialCode: all.slice(0, all.length - 10), contact: all.slice(-10) };
  return { dialCode: '91', contact: all };
}

export function ParentLink() {
  const queryClient = useQueryClient();
  const parent = useParent();
  const existing = parent.data ?? null;
  const [mode, setMode] = useState<Mode>('view');
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<ParentDetails | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(parentSchema),
    defaultValues: { firstName: '', lastName: '', contactMethod: 'whatsapp', dialCode: '91', contact: '' },
  });
  const method = form.watch('contactMethod');
  const { errors } = form.formState;

  const refresh = () => queryClient.invalidateQueries({ queryKey: profileKeys.parent });

  const save = useMutation({
    mutationFn: async (next: ParentDetails) => {
      if (mode === 'edit' && existing && sameContact(existing, next)) {
        await profileApi.renameParent(existing.id, next);
        return 'saved' as const;
      }
      await profileApi.sendParentOtp(next);
      return 'otp' as const;
    },
    onSuccess: (result) => {
      if (result === 'saved') {
        void refresh();
        setStep('success');
      } else {
        setOtp('');
        setOtpError(null);
        setStep('otp');
      }
    },
  });

  const verify = useMutation({
    mutationFn: (code: string) => profileApi.verifyParentOtp(details!, code),
    onSuccess: () => {
      void refresh();
      setStep('success');
    },
    onError: (error) => setOtpError(userMessage(error)),
  });

  const resend = useMutation({ mutationFn: () => profileApi.sendParentOtp(details!) });

  const start = (next: Mode) => {
    if (next === 'edit' && existing) {
      const phone = existing.contactMethod === 'whatsapp' ? splitPhone(existing.contactValue) : null;
      form.reset({
        firstName: existing.firstName,
        lastName: existing.lastName,
        contactMethod: existing.contactMethod,
        dialCode: phone?.dialCode ?? '91',
        contact: phone ? phone.contact : existing.contactValue,
      });
    } else {
      form.reset({ firstName: '', lastName: '', contactMethod: 'whatsapp', dialCode: '91', contact: '' });
    }
    save.reset();
    setStep('details');
    setMode(next);
  };

  const cancel = () => {
    setMode('view');
    setStep('details');
  };

  const onSubmit = form.handleSubmit((values) => {
    const next = toParentDetails(values);
    setDetails(next);
    save.mutate(next);
  });

  const submitOtp = () => {
    const parsed = parentOtpSchema.safeParse({ otp });
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
      return;
    }
    verify.mutate(otp);
  };

  const contactChanged = mode === 'edit' && existing && details !== null && !sameContact(existing, details);
  const editing = mode !== 'view';

  return (
    <section aria-labelledby="parent-title" className="w-full p-5 md:p-10">
      <div className="mb-1 flex items-center justify-between">
        <h2 id="parent-title" className="text-[16px] leading-[22px] font-bold text-neutral-900">
          Parent / Teacher Info
        </h2>
        {mode === 'view' && existing && (
          <button
            type="button"
            onClick={() => start('edit')}
            className="bg-info-50 text-info-600 flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold hover:opacity-80"
          >
            <Pencil aria-hidden className="size-3" /> Edit
          </button>
        )}
      </div>

      {mode === 'view' &&
        (parent.isPending ? (
          <p className="text-neutral-350 mt-4 text-sm">Loading…</p>
        ) : existing ? (
          <div className="mt-4">
            <p className="text-neutral-350 mb-3 text-sm">Linked parent account</p>
            <div className="border-info-50 bg-info-50/40 overflow-hidden rounded-lg border-[1.5px]">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <span className="bg-info-600 text-on-brand flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {existing.firstName.charAt(0)}
                  {existing.lastName.charAt(0)}
                </span>
                <div>
                  <p className="text-[15px] font-bold text-neutral-800">
                    {existing.firstName} {existing.lastName}
                  </p>
                  <span className="bg-success-50 text-success-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                    ✓ Verified
                  </span>
                </div>
              </div>
              <div className="bg-info-50 mx-4 h-px" />
              <div className="flex items-center gap-3 px-4 py-3">
                <MethodIcon method={existing.contactMethod} />
                <div>
                  <p className="text-neutral-350 text-xs font-medium">{methodLabel(existing.contactMethod)}</p>
                  <p className="text-sm font-semibold text-neutral-700">{existing.contactValue}</p>
                </div>
              </div>
            </div>
            <p className="text-neutral-350 mt-2 flex items-center gap-1 text-xs">
              <Info aria-hidden className="size-3" /> Only one parent account is allowed per student.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-neutral-350 mb-4 text-sm">No parent account linked yet.</p>
            <button
              type="button"
              onClick={() => start('add')}
              className="border-info-400/50 text-info-600 hover:bg-info-50 flex h-[46px] w-full items-center justify-center gap-2 rounded-md border-2 border-dashed text-[15px] font-bold"
            >
              <Plus aria-hidden className="size-4" /> Add Parent Account
            </button>
          </div>
        ))}

      {editing && (
        <>
          <p className="text-neutral-350 mb-5 text-sm">
            {step === 'otp'
              ? `Enter the 6-digit code sent to your ${methodLabel(details?.contactMethod ?? method)}`
              : mode === 'edit'
                ? 'Update the parent details below'
                : 'Fill in the details to create a parent account'}
          </p>

          {step === 'details' && (
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="parent-first" className="text-neutral-550 mb-1 block text-sm font-bold">
                    First Name<span className="text-danger">*</span>
                  </label>
                  <input id="parent-first" placeholder="First Name" className={inputClass(!!errors.firstName)} {...form.register('firstName')} />
                  {errors.firstName && <p className="text-danger mt-1 text-xs">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label htmlFor="parent-last" className="text-neutral-550 mb-1 block text-sm font-bold">
                    Last Name<span className="text-danger">*</span>
                  </label>
                  <input id="parent-last" placeholder="Last Name" className={inputClass(!!errors.lastName)} {...form.register('lastName')} />
                  {errors.lastName && <p className="text-danger mt-1 text-xs">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <span className="text-neutral-550 mb-2 block text-sm font-bold">
                  Contact Method<span className="text-danger">*</span>
                </span>
                <div role="radiogroup" aria-label="Contact method" className="border-info-50 bg-info-50/50 flex gap-1 rounded-md border-[1.5px] p-1">
                  {(['whatsapp', 'email'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={method === option}
                      onClick={() => {
                        form.setValue('contactMethod', option);
                        form.setValue('contact', '');
                        form.clearErrors();
                      }}
                      className={cx(
                        'flex flex-1 items-center justify-center gap-2 rounded-sm py-2 text-sm font-semibold',
                        method === option ? 'bg-surface text-info-600 border-info-50 border shadow-sm' : 'text-neutral-350',
                      )}
                    >
                      <MethodIcon method={option} active={method === option} />
                      {methodLabel(option)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {method === 'whatsapp' ? (
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor="parent-dial">
                      Country code
                    </label>
                    <span className="relative w-[88px] shrink-0">
                      <span className="text-neutral-550 absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold">+</span>
                      <input id="parent-dial" inputMode="numeric" className={cx(inputClass(), 'pl-6')} {...form.register('dialCode')} />
                    </span>
                    <label className="sr-only" htmlFor="parent-contact">
                      WhatsApp number
                    </label>
                    <input
                      id="parent-contact"
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      className={inputClass(!!errors.contact)}
                      {...form.register('contact')}
                    />
                  </div>
                ) : (
                  <>
                    <label className="sr-only" htmlFor="parent-contact">
                      Email address
                    </label>
                    <input id="parent-contact" type="email" placeholder="email" className={inputClass(!!errors.contact)} {...form.register('contact')} />
                  </>
                )}
                {errors.contact && <p className="text-danger mt-1 text-xs">{errors.contact.message}</p>}
              </div>
              {save.isError && (
                <p role="alert" className="text-danger text-sm">
                  {userMessage(save.error)}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancel}
                  className="border-info-50 text-neutral-550 h-[46px] flex-1 rounded-md border-[1.5px] text-[15px] font-bold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <SolidButton type="submit" busy={save.isPending} className="flex-[2]">
                  {mode === 'edit' && existing && sameContact(existing, toParentDetails(form.watch())) ? 'Save Changes' : 'Send OTP & Continue'}
                </SolidButton>
              </div>
            </form>
          )}

          {step === 'otp' && details && (
            <div className="flex flex-col gap-6">
              <div className="bg-info-50 border-info-50 flex items-center gap-2 rounded-md border px-4 py-3">
                <MethodIcon method={details.contactMethod} />
                <div className="min-w-0">
                  <p className="text-neutral-350 text-xs">Sending OTP to</p>
                  <p className="truncate text-sm font-bold text-neutral-700">{details.contactValue}</p>
                </div>
                <button type="button" onClick={() => setStep('details')} className="text-info-600 ml-auto text-xs font-semibold hover:underline">
                  Change
                </button>
              </div>
              <div>
                <label htmlFor="parent-otp" className="text-neutral-550 mb-1 block text-sm font-bold">
                  Verification code
                </label>
                <input
                  id="parent-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => {
                    setOtp(digits(event.target.value).slice(0, 6));
                    setOtpError(null);
                  }}
                  className={cx(inputClass(!!otpError), 'h-14 text-center text-xl tracking-[0.5em]')}
                />
                {otpError && (
                  <p role="alert" className="text-danger mt-1 text-xs">
                    {otpError}
                  </p>
                )}
              </div>
              <SolidButton type="button" busy={verify.isPending} disabled={otp.length < 6} onClick={submitOtp}>
                {contactChanged ? 'Verify & Save Changes' : mode === 'edit' ? 'Verify & Save Changes' : 'Verify & Create Account'}
              </SolidButton>
              <p className="text-neutral-350 text-center text-sm">
                Didn&apos;t receive the code?{' '}
                <button
                  type="button"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate()}
                  className="text-info-600 font-semibold hover:underline disabled:opacity-60"
                >
                  {resend.isSuccess ? 'Code sent again' : 'Resend OTP'}
                </button>
              </p>
            </div>
          )}

          {step === 'success' && details && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="bg-success-100 flex size-16 items-center justify-center rounded-full">
                <Check aria-hidden className="text-success-700 size-8" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-neutral-800">{mode === 'edit' ? 'Changes Saved!' : 'Account Created!'}</h3>
                <p className="text-neutral-350 mt-1 text-sm">
                  {details.firstName} {details.lastName}&apos;s parent account has been {mode === 'edit' ? 'updated' : 'set up'} successfully.
                </p>
              </div>
              <div className="bg-info-50 w-full rounded-md px-4 py-3 text-left">
                <p className="text-neutral-350 text-xs">Verified {methodLabel(details.contactMethod)}</p>
                <p className="text-sm font-bold text-neutral-700">{details.contactValue}</p>
              </div>
              <SolidButton type="button" onClick={cancel}>
                Done
              </SolidButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}
