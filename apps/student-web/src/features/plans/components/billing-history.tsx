'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import type { InvoiceStatus, Transaction } from '../api';
import { useBillingHistory } from '../hooks';
import { formatInDate, formatInrExact } from '../money';

const STATUS: Record<InvoiceStatus, string> = {
  paid: 'bg-plan-paid-soft border-plan-paid-line text-plan-paid',
  refunded: 'bg-plan-refund-soft border-accent-400 text-plan-refund',
  failed: 'bg-plan-expired-soft border-plan-expired text-plan-red',
  pending: 'bg-canvas border-neutral-300 text-neutral-500',
};

const StatusBadge = ({ status }: { status: InvoiceStatus }) => (
  <span className={cx('inline-flex items-center rounded-full border px-2.5 py-[3px] text-[11px] font-semibold tracking-wide uppercase', STATUS[status])}>
    {status}
  </span>
);

const CARD = 'border-neutral-100 bg-surface rounded-lg border shadow-sm';

function InvoiceButton({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="bg-neutral-100 text-neutral-350 inline-flex w-full items-center justify-center rounded-md px-[18px] py-3 text-[14px] font-semibold">
        Invoice unavailable
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-brand text-on-brand hover:bg-brand-800 inline-flex w-full items-center justify-center gap-2 rounded-md px-[18px] py-3 text-[14px] font-semibold"
    >
      <Download aria-hidden size={16} />
      Download Invoice
    </a>
  );
}

function Table({ rows }: { rows: Transaction[] }) {
  return (
    <div className={cx(CARD, 'mt-3 hidden overflow-hidden md:block')}>
      <table className="w-full border-collapse text-left">
        <thead className="bg-plan-panel">
          <tr>
            {['Invoice', 'Description', 'Date', 'Amount', 'Status', 'Actions'].map((heading) => (
              <th key={heading} scope="col" className="text-brand px-5 py-4 text-[11px] font-bold tracking-wider uppercase">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((txn) => (
            <tr key={txn.id} className="border-neutral-100 hover:bg-plan-panel border-t">
              <td className="px-5 py-5 text-[13px] text-neutral-600">{txn.invoiceNo}</td>
              <td className="text-plan-ink px-5 py-5 text-[14px] font-semibold">{txn.description}</td>
              <td className="px-5 py-5 text-[13px] text-neutral-500">{formatInDate(txn.date)}</td>
              <td className="text-plan-ink px-5 py-5 text-[14px] font-semibold">{formatInrExact(txn.amount)}</td>
              <td className="px-5 py-5">
                <StatusBadge status={txn.status} />
              </td>
              <td className="px-5 py-5">
                {txn.invoiceUrl ? (
                  <a href={txn.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-brand inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline">
                    <Download aria-hidden size={14} />
                    PDF
                  </a>
                ) : (
                  <span className="text-neutral-350 text-[13px]">Unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ txn }: { txn: Transaction }) {
  return (
    <div className={cx(CARD, 'overflow-hidden')}>
      <div className="bg-plan-panel flex items-start justify-between gap-3 px-5 py-4">
        <p className="text-plan-ink text-md leading-snug font-bold">{txn.description}</p>
        <StatusBadge status={txn.status} />
      </div>
      <div className="border-neutral-100 flex flex-col gap-2.5 border-t px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-brand text-[11px] font-bold tracking-wider uppercase">Amount</span>
          <span className="text-plan-ink text-[15px] font-bold">{formatInrExact(txn.amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-brand text-[11px] font-bold tracking-wider uppercase">Date</span>
          <span className="text-[14px] text-neutral-500">{formatInDate(txn.date)}</span>
        </div>
        <InvoiceButton url={txn.invoiceUrl} />
      </div>
    </div>
  );
}

/** /neet/plans/billing — every transaction with its invoice. */
export function BillingHistory({ exam }: { exam: ExamConfig }) {
  const history = useBillingHistory();
  const rows = history.data ?? [];
  return (
    <div className="bg-canvas min-h-full">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
        <Link href={routes.plans(exam.slug)} className="hover:text-brand mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
          <ArrowLeft aria-hidden size={16} />
          Back to my plans
        </Link>
        <h1 className="text-plan-ink text-[26px] leading-tight font-bold md:text-[32px]">Billing &amp; Invoices</h1>
        <p className="mt-1.5 text-[13px] text-neutral-500 md:text-[14px]">
          Check active plan statuses, configure your card on file, and download invoices.
        </p>
        <h2 className="text-brand mt-6 text-[15px] font-semibold">Transaction History</h2>

        {history.isPending && (
          <div className="bg-surface mt-3 flex items-center justify-center gap-2 rounded-lg py-12 text-[13px] text-neutral-500 shadow-sm">
            <Loader2 aria-hidden size={16} className="animate-spin" />
            Loading transactions
          </div>
        )}
        {history.isError && (
          <div className="bg-surface mt-3 rounded-lg px-5 py-10 text-center shadow-sm">
            <p className="text-danger text-[14px] font-medium">{userMessage(history.error, "Couldn't load your transactions. Try again.")}</p>
            <button type="button" onClick={() => history.refetch()} className="bg-brand text-on-brand mt-3 rounded-sm px-4 py-2 text-[13px] font-semibold">
              Retry
            </button>
          </div>
        )}
        {history.isSuccess && rows.length === 0 && (
          <div className="bg-surface mt-3 rounded-lg px-5 py-12 text-center shadow-sm">
            <p className="text-plan-ink text-[15px] font-semibold">No invoices yet</p>
            <p className="mt-1 text-[13px] text-neutral-500">Your invoices will show up here after your first purchase.</p>
            <Link href={routes.plansPurchase(exam.slug)} className="bg-brand text-on-brand mt-4 inline-block rounded-sm px-[18px] py-2.5 text-[13px] font-semibold">
              Explore plans
            </Link>
          </div>
        )}
        {rows.length > 0 && (
          <>
            <Table rows={rows} />
            <div className="mt-3 flex flex-col gap-3.5 md:hidden">
              {rows.map((txn) => (
                <Card key={txn.id} txn={txn} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
