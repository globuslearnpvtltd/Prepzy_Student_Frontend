'use client';

import { Badge, Button, Card, Skeleton, cx } from '@prepzy/design-system';
import { ChevronLeft, ChevronRight, Download, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import type { InvoiceStatus, Transaction } from '../api';
import { useBillingHistory } from '../hooks';
import { formatInDate, formatInrExact } from '../money';

const STATUS: Record<InvoiceStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'info' },
};

export const PaymentStatusChip = ({ status }: { status: InvoiceStatus }) => <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;

const amountText = (txn: Transaction) => `${txn.status === 'refunded' ? '− ' : ''}${formatInrExact(txn.amount)}`;

function InvoiceLink({ url, compact }: { url: string | null; compact?: boolean }) {
  if (!url) return <span className="text-neutral-350 text-[13px]">{compact ? '—' : 'No invoice'}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline"
    >
      <Download aria-hidden size={14} />
      Invoice
    </a>
  );
}

const TH = 'text-plan-label px-4 py-3 text-left text-[11px] font-bold tracking-[0.08em] uppercase';

/** Payments as a table (md and up) or stacked rows (phones). */
export function PaymentRows({ rows, label }: { rows: Transaction[]; label: string }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse" aria-label={label}>
          <thead className="bg-plan-panel">
            <tr>
              {['Date', 'Description', 'Invoice no.', 'Amount', 'Status', 'Invoice'].map((heading) => (
                <th key={heading} scope="col" className={TH}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((txn) => (
              <tr key={txn.id} className="border-plan-line border-t">
                <td className="px-4 py-3.5 text-[13px] whitespace-nowrap text-neutral-600">{formatInDate(txn.date)}</td>
                <td className="text-plan-ink px-4 py-3.5 text-[14px] font-semibold">{txn.description || 'Plan purchase'}</td>
                <td className="px-4 py-3.5 text-[13px] text-neutral-600">{txn.invoiceNo || '—'}</td>
                <td className="text-plan-ink px-4 py-3.5 text-[14px] font-semibold whitespace-nowrap">{amountText(txn)}</td>
                <td className="px-4 py-3.5">
                  <PaymentStatusChip status={txn.status} />
                </td>
                <td className="px-4 py-3.5">
                  <InvoiceLink url={txn.invoiceUrl} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-plan-line flex flex-col divide-y md:hidden" aria-label={label}>
        {rows.map((txn) => (
          <li key={txn.id} className="flex flex-col gap-1.5 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-plan-ink m-0 text-[14px] leading-snug font-semibold">{txn.description || 'Plan purchase'}</p>
              <PaymentStatusChip status={txn.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-neutral-500">
                {formatInDate(txn.date)}
                {txn.invoiceNo ? ` · ${txn.invoiceNo}` : ''}
              </span>
              <span className="text-plan-ink font-semibold">{amountText(txn)}</span>
            </div>
            <InvoiceLink url={txn.invoiceUrl} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="border-plan-line flex items-center justify-between gap-3 border-t px-4 py-3">
      <Button intent="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft aria-hidden size={15} /> Prev
      </Button>
      <span className="text-[13px] font-medium text-neutral-600">
        Page {page} of {totalPages}
      </span>
      <Button intent="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Next <ChevronRight aria-hidden size={15} />
      </Button>
    </nav>
  );
}

/**
 * "Billing history": every payment of the exam (paid, pending, failed, refunded) with its invoice, a page at a time.
 * The same for every exam; shown under the plans on /[exam]/plans and on its own at /[exam]/plans/billing.
 */
export function BillingHistory({ exam, standalone = false }: { exam: ExamConfig; standalone?: boolean }) {
  const [page, setPage] = useState(1);
  const history = useBillingHistory(exam, page);
  const rows = history.data?.payments ?? [];
  const Heading = standalone ? 'h1' : 'h2';
  return (
    <section id="billing" aria-labelledby="billing-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Heading id="billing-title" className={cx('text-plan-ink font-bold', standalone ? 'text-[26px] md:text-[30px]' : 'text-xl')}>
            Billing history
          </Heading>
          <p className="mt-1 text-[13px] text-neutral-500">Every payment for this exam, with its invoice.</p>
        </div>
        {standalone && (
          <Link href={routes.plans(exam.slug)} className="text-brand text-[13px] font-semibold hover:underline">
            Back to my plans
          </Link>
        )}
      </div>
      <Card appearance="outline" padding="none" className="mt-4 overflow-hidden">
        {history.isPending ? (
          <div className="flex flex-col gap-3 p-4" aria-label="Loading payments">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : history.isError ? (
          <div className="px-5 py-10 text-center">
            <p className="text-danger text-[14px] font-medium">{userMessage(history.error, "Couldn't load your payments. Try again.")}</p>
            <Button size="sm" className="mt-3" onClick={() => history.refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <span className="bg-plan-chip text-plan-violet flex size-10 items-center justify-center rounded-full">
              <ReceiptText aria-hidden size={18} />
            </span>
            <p className="text-plan-ink mt-3 text-[15px] font-semibold">No payments yet</p>
            <p className="mt-1 text-[13px] text-neutral-500">Your invoices show up here after your first purchase.</p>
          </div>
        ) : (
          <>
            <PaymentRows rows={rows} label="Billing history" />
            <Pager page={history.data?.page ?? page} totalPages={history.data?.totalPages ?? 1} onPage={setPage} />
          </>
        )}
      </Card>
    </section>
  );
}
