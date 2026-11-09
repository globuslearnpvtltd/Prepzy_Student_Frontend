'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Payout, PayoutStatus } from '../api';
import { formatDate, inr } from '../format';
import { usePartnerProfile, usePartnerSummary, usePayouts, useRequestPayout } from '../hooks';
import { payoutSchema, type PayoutValues } from '../schemas';
import { errorText } from './chrome';
import { PartnerLoadError, PartnerLoading, PartnerShell } from './shell';

const card = 'rounded-[16px] border border-partner-border bg-neutral-0';
const eyebrow = 'text-[11px] font-bold tracking-[0.12em] text-brand-700 uppercase';
const th = 'px-6 pb-2 text-[11px] font-bold whitespace-nowrap text-neutral-400 uppercase';

const STATUS_BADGE: Record<PayoutStatus, string> = {
  requested: 'bg-partner-tile text-brand-700',
  approved: 'bg-partner-amber-soft text-partner-amber',
  settled: 'bg-partner-ok-soft text-partner-ok',
  rejected: 'bg-partner-red-soft text-partner-red',
};

const STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'settled', label: 'Settled' },
] as const;

export function PayoutStepper({ status }: { status: PayoutStatus }) {
  if (status === 'rejected') {
    return (
      <div className="border-partner-red-line bg-partner-red-soft text-partner-red my-6 rounded-md border px-6 py-4 text-[13px]">
        This request was rejected. Check the reason below and submit a new request once resolved.
      </div>
    );
  }
  const current = STEPS.findIndex((step) => step.key === status);
  return (
    <ol className="my-6 flex items-center" aria-label="Request progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <Fragment key={step.key}>
            <li className="flex-1 text-center" aria-current={i === current ? 'step' : undefined}>
              <div
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold ${done ? 'bg-success-500 text-neutral-0' : 'bg-partner-rule text-partner-grey'}`}
              >
                {done ? <Check size={14} strokeWidth={3} aria-label="done" /> : i + 1}
              </div>
              <div className={`mt-1.5 text-[12px] font-semibold ${done ? 'text-brand-950' : 'text-partner-grey'}`}>{step.label}</div>
            </li>
            {i < STEPS.length - 1 && (
              <li aria-hidden className={`-mt-5 h-[3px] flex-1 list-none ${i < current ? 'bg-success-500' : 'bg-partner-rule'}`} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

function RequestForm({ balance, minimum, kycVerified, openPayout }: { balance: number; minimum: number; kycVerified: boolean; openPayout: boolean }) {
  const request = useRequestPayout();
  const [success, setSuccess] = useState('');
  const schema = useMemo(() => payoutSchema(minimum, balance), [minimum, balance]);
  const form = useForm<PayoutValues>({ resolver: zodResolver(schema), defaultValues: { amount: '' }, mode: 'onChange' });
  const amount = form.watch('amount');
  const canSubmit = kycVerified && !openPayout && amount.trim() !== '' && form.formState.isValid;
  const fieldError = amount.trim() ? form.formState.errors.amount?.message : undefined;

  const submit = form.handleSubmit(async (values) => {
    setSuccess('');
    if (!canSubmit) return;
    try {
      await request.mutateAsync(Number(values.amount));
      setSuccess('Payout requested.');
      form.reset({ amount: '' });
    } catch {
      // shown from request.error below
    }
  });

  return (
    <form onSubmit={submit} noValidate className={`${card} p-[20px]`}>
      <div className={eyebrow}>Request a payout</div>
      <div className="text-partner-grey mt-1 text-[12px]">Available</div>
      <div className="text-brand-950 text-[28px] leading-[1.5] font-black">{inr(balance)}</div>

      <label htmlFor="partner-payout-amount" className="text-partner-nav mt-1 block text-[12.5px] font-semibold">
        Amount to withdraw
      </label>
      <input
        id="partner-payout-amount"
        type="number"
        inputMode="decimal"
        placeholder={`Min ${inr(minimum)}`}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? 'partner-payout-amount-error' : undefined}
        className="border-partner-input-line text-brand-950 focus:border-brand-700 mt-1 w-full rounded-md border px-3.5 py-2.5 text-[14px] outline-none"
        {...form.register('amount', { onChange: () => request.reset() })}
      />
      {fieldError && (
        <p id="partner-payout-amount-error" className="text-partner-red mt-1 text-[12px]">
          {fieldError}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between text-[12.5px]">
        <span className="text-partner-grey">Minimum payout</span>
        <span className="text-brand-950 font-semibold">{inr(minimum)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[12.5px]">
        <span className="text-partner-grey">KYC</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${kycVerified ? 'bg-partner-ok-soft text-partner-ok' : 'bg-partner-amber-soft text-partner-amber'}`}
        >
          {kycVerified ? 'Verified' : 'Not verified'}
        </span>
      </div>

      {!kycVerified && (
        <p className="text-partner-amber mt-4 mb-4 text-[12px] leading-[17px]">Complete KYC verification before you can request a payout.</p>
      )}
      {openPayout && (
        <p className="text-brand-700 mt-4 mb-4 text-[12px] leading-[17px]">
          You already have a request in progress. A new one can&apos;t be submitted until it&apos;s resolved.
        </p>
      )}
      {request.isError && (
        <p role="alert" className="text-partner-red mt-4 mb-4 text-[12px]">
          {errorText(request.error, 'Something went wrong. Please try again.')}
        </p>
      )}
      {success && <p className="text-partner-ok mt-4 mb-4 text-[12px]">{success}</p>}

      <button
        type="submit"
        disabled={!canSubmit || request.isPending}
        className="bg-brand-700 text-neutral-0 hover:bg-partner-hover mt-1 w-full rounded-md py-4 text-[14px] font-bold transition-colors disabled:opacity-50"
      >
        {request.isPending ? 'Requesting…' : 'Request payout'}
      </button>
    </form>
  );
}

function History({ payouts }: { payouts: Payout[] }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`${eyebrow} p-[20px] pb-4`}>Payout history</div>
      {payouts.length === 0 ? (
        <div className="text-partner-grey px-[20px] py-6 text-center text-[13px]">Nothing yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Date</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={`${th} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-partner-border border-t">
                  <td className="text-neutral-650 px-6 py-4 text-[13px] whitespace-nowrap">{formatDate(payout.requestedAt)}</td>
                  <td className="text-brand-950 px-6 py-4 text-right text-[13px] font-bold whitespace-nowrap">{inr(payout.amount)}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap capitalize ${STATUS_BADGE[payout.status]}`}>
                      {payout.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Request a payout (KYC verified, one open request at a time) and follow its progress. */
export function PartnerPayouts() {
  const profile = usePartnerProfile();
  const summary = usePartnerSummary();
  const payouts = usePayouts();

  if (profile.isPending || summary.isPending || payouts.isPending) return <PartnerLoading />;
  if (profile.isError || summary.isError || payouts.isError) {
    return (
      <PartnerLoadError
        onRetry={() => {
          void profile.refetch();
          void summary.refetch();
          void payouts.refetch();
        }}
      />
    );
  }

  const list = payouts.data.payouts;
  const latest = list[0];
  const openPayout = list.some((payout) => payout.status === 'requested' || payout.status === 'approved');

  return (
    <PartnerShell profile={profile.data} active="payouts">
      <h1 className="text-brand-950 mb-6 text-[24px] leading-[1.2] font-bold">Payouts</h1>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[480px_1fr]">
        <RequestForm
          balance={summary.data.balance}
          minimum={payouts.data.minPayoutAmount}
          kycVerified={profile.data.kycStatus === 'verified'}
          openPayout={openPayout}
        />
        <div className="flex flex-col gap-12">
          <div className={`${card} p-[20px]`}>
            <div className={eyebrow}>Latest request status</div>
            {latest ? (
              <>
                <PayoutStepper status={latest.status} />
                {latest.status === 'rejected' && latest.rejectionReason && (
                  <p className="text-partner-grey mb-4 text-[12.5px] leading-[18px]">Reason: {latest.rejectionReason}</p>
                )}
              </>
            ) : (
              <p className="text-partner-grey mt-6 mb-4 text-[13px]">No payout requests yet.</p>
            )}
          </div>
          <History payouts={list} />
        </div>
      </div>
    </PartnerShell>
  );
}
