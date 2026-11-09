'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  EyeOff,
  Hash,
  Info,
  Landmark,
  Lock,
  RefreshCw,
  Shield,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { BankDetails, KycStatus } from '../api';
import { useBankDetails, usePartnerProfile, useSaveBankDetails } from '../hooks';
import { bankDetailsSchema, type BankDetailsFormValues, type BankDetailsValues } from '../schemas';
import { errorText } from './chrome';
import { PartnerLoadError, PartnerLoading, PartnerShell } from './shell';

const STATUS: Record<KycStatus, { icon: LucideIcon; box: string; tile: string; text: string; title: string; desc: string }> = {
  pending: {
    icon: Info,
    box: 'bg-brand-50 border-partner-field-line',
    tile: 'bg-partner-tile',
    text: 'text-brand-700',
    title: 'Add your bank details',
    desc: 'Submit your details below to enable payouts once you have earnings to withdraw.',
  },
  submitted: {
    icon: Clock,
    box: 'bg-partner-amber-soft border-partner-amber-line',
    tile: 'bg-partner-amber-tile',
    text: 'text-partner-amber',
    title: 'Under review',
    desc: "We're verifying your details — this usually takes 1-2 business days.",
  },
  verified: {
    icon: CheckCircle2,
    box: 'bg-partner-ok-soft border-partner-ok-line',
    tile: 'bg-partner-ok-tile',
    text: 'text-partner-ok',
    title: 'Verified',
    desc: 'Your bank details are verified and payouts are enabled.',
  },
  rejected: {
    icon: TriangleAlert,
    box: 'bg-partner-red-soft border-partner-red-line',
    tile: 'bg-partner-red-tile',
    text: 'text-partner-red',
    title: 'Resubmission needed',
    desc: "Something didn't check out — please review your details and submit again.",
  },
};

const inputClass =
  'w-full rounded-md border border-partner-field-line px-3.5 py-2.5 text-[14px] text-brand-950 outline-none transition-colors focus:border-brand-700 focus:shadow-focus-ring';

function FieldCard({
  id,
  label,
  icon: Icon,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-partner-rule bg-neutral-0 rounded-lg border p-[18px] shadow-[0_1px_2px_rgba(34,28,74,0.04),0_8px_24px_rgba(34,28,74,0.06)] transition-shadow hover:shadow-[0_1px_2px_rgba(34,28,74,0.04),0_10px_28px_rgba(34,28,74,0.09)]">
      <label htmlFor={id} className="text-partner-nav flex items-center gap-2 text-[12.5px] font-semibold">
        <Icon size={14} className="text-partner-icon" />
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error && <p className="text-partner-grey mt-1.5 text-[12px]">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-partner-red mt-1.5 text-[12px]">
          {error}
        </p>
      )}
    </div>
  );
}

function BankForm({ details }: { details: BankDetails | null }) {
  const save = useSaveBankDetails();
  const [success, setSuccess] = useState('');
  const form = useForm<BankDetailsFormValues, unknown, BankDetailsValues>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      accountHolderName: details?.accountHolderName ?? '',
      bankAccountNumber: '',
      ifscCode: details?.ifscCode ?? '',
      pan: '',
    },
  });
  const { errors } = form.formState;
  const pan = form.watch('pan');
  const accountNumber = form.watch('bankAccountNumber');

  // Saved details arrive after the first render on a cold load; fill the fields that can be shown.
  useEffect(() => {
    if (!details) return;
    if (!form.getValues('accountHolderName')) form.setValue('accountHolderName', details.accountHolderName);
    if (!form.getValues('ifscCode')) form.setValue('ifscCode', details.ifscCode);
  }, [details, form]);

  const submit = form.handleSubmit(async (values) => {
    setSuccess('');
    try {
      await save.mutateAsync(values);
      setSuccess('Bank details saved and sent for review.');
      form.reset({ ...form.getValues(), bankAccountNumber: '', pan: '' });
    } catch {
      // shown from save.error below
    }
  });

  const describedBy = (id: string, hasError: boolean) => (hasError ? `${id}-error` : undefined);
  const upper = (max: number) => ({
    onChange: (event: { target: { value: string } }) => {
      event.target.value = event.target.value.toUpperCase().slice(0, max);
    },
  });

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FieldCard id="partner-holder" label="Full legal name" icon={User} error={errors.accountHolderName?.message}>
          <input
            id="partner-holder"
            type="text"
            autoComplete="name"
            placeholder="As per your bank account"
            aria-invalid={!!errors.accountHolderName}
            aria-describedby={describedBy('partner-holder', !!errors.accountHolderName)}
            className={inputClass}
            {...form.register('accountHolderName')}
          />
        </FieldCard>

        <FieldCard
          id="partner-pan"
          label="PAN"
          icon={CreditCard}
          error={errors.pan?.message}
          hint={details?.panMasked && !pan ? `On file: ${details.panMasked} — enter a new PAN to change it` : undefined}
        >
          <input
            id="partner-pan"
            type="text"
            autoComplete="off"
            maxLength={10}
            placeholder={details?.panMasked || 'ABCPV1234X'}
            aria-invalid={!!errors.pan}
            aria-describedby={describedBy('partner-pan', !!errors.pan)}
            className={`${inputClass} uppercase`}
            {...form.register('pan', upper(10))}
          />
        </FieldCard>

        <FieldCard
          id="partner-account"
          label="Bank account number"
          icon={Landmark}
          error={errors.bankAccountNumber?.message}
          hint={
            details?.accountNumberMasked && !accountNumber
              ? `On file: ${details.accountNumberMasked} — enter a new number to change it`
              : undefined
          }
        >
          <input
            id="partner-account"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={details?.accountNumberMasked || 'Account number'}
            aria-invalid={!!errors.bankAccountNumber}
            aria-describedby={describedBy('partner-account', !!errors.bankAccountNumber)}
            className={inputClass}
            {...form.register('bankAccountNumber', {
              onChange: (event: { target: { value: string } }) => {
                event.target.value = event.target.value.replace(/\D/g, '').slice(0, 18);
              },
            })}
          />
        </FieldCard>

        <FieldCard id="partner-ifsc" label="IFSC" icon={Hash} error={errors.ifscCode?.message}>
          <input
            id="partner-ifsc"
            type="text"
            autoComplete="off"
            maxLength={11}
            placeholder="HDFC0000123"
            aria-invalid={!!errors.ifscCode}
            aria-describedby={describedBy('partner-ifsc', !!errors.ifscCode)}
            className={`${inputClass} uppercase`}
            {...form.register('ifscCode', upper(11))}
          />
        </FieldCard>
      </div>

      {save.isError && (
        <p role="alert" className="text-partner-red mt-6 text-[13px]">
          {errorText(save.error, 'Something went wrong. Please try again.')}
        </p>
      )}
      {success && <p className="text-partner-ok mt-6 text-[13px]">{success}</p>}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="bg-brand-700 text-neutral-0 hover:bg-partner-hover mt-4 inline-flex items-center gap-2 rounded-md px-6 py-4 text-[14px] font-semibold shadow-[0_4px_14px_rgba(61,52,139,0.3)] transition-all hover:shadow-[0_6px_18px_rgba(61,52,139,0.4)] disabled:opacity-50 disabled:shadow-none"
      >
        {form.formState.isSubmitting ? 'Saving…' : 'Save details'}
      </button>

      <p className="text-partner-grey mt-6 text-[12px] leading-[17px]">
        Changing verified bank details sends your account back for review before payouts can resume.
      </p>
    </form>
  );
}

const PROTECTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Lock, text: 'Bank-grade AES-256 encryption at rest' },
  { icon: EyeOff, text: 'Only visible to you and the Prepzy finance team' },
  { icon: RefreshCw, text: 'Update anytime — re-verification only when it changes' },
];

/** KYC status, the bank / PAN form (masked values only) and how the data is protected. */
export function PartnerBankDetails() {
  const profile = usePartnerProfile();
  const bank = useBankDetails();

  if (profile.isPending || bank.isPending) return <PartnerLoading />;
  if (profile.isError || bank.isError) {
    return (
      <PartnerLoadError
        onRetry={() => {
          void profile.refetch();
          void bank.refetch();
        }}
      />
    );
  }

  const status = STATUS[profile.data.kycStatus];
  const StatusIcon = status.icon;

  return (
    <PartnerShell profile={profile.data} active="kyc">
      <h1 className="text-brand-950 mb-6 text-[24px] leading-[1.2] font-bold">KYC &amp; bank details</h1>

      <div className={`mb-6 flex items-start gap-3.5 rounded-lg border p-6 ${status.box}`} role="status">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${status.tile} ${status.text}`}>
          <StatusIcon size={19} />
        </div>
        <div>
          <div className={`text-[14px] font-bold ${status.text}`}>{status.title}</div>
          <p className={`mt-0.5 mb-4 text-[12.5px] leading-[18px] opacity-85 ${status.text}`}>{status.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <BankForm details={bank.data} />

        <div className="border-partner-rule bg-neutral-0 h-fit rounded-lg border p-6">
          <div className="mb-3.5 flex items-center gap-2">
            <div className="bg-partner-tile text-brand-700 grid h-8 w-8 place-items-center rounded-[8px]">
              <Shield size={15} />
            </div>
            <span className="text-brand-950 text-[13.5px] font-bold">Your data is protected</span>
          </div>
          <ul className="flex flex-col gap-4 pl-8">
            {PROTECTIONS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon size={14} className="text-partner-icon mt-0.5 shrink-0" />
                <span className="text-partner-body-soft text-[12.5px] leading-[17px]">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PartnerShell>
  );
}
