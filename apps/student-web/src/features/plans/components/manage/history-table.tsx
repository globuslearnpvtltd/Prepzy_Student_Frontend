import Image from 'next/image';
import type { HistoryRow } from '../../manage-data';

const head = 'font-partner m-0 text-[11px] leading-normal font-bold tracking-[0.77px] text-onboarding-label';
const cell = 'font-partner text-[15.5px] font-semibold text-onboarding-ink';

/** Desktop invoice table: one plan's invoices (under its card) or the invoices of ended plans. */
export function HistoryTable({
  title,
  rows,
  footer,
  emptyText = 'No invoices yet.',
  onDownload,
}: {
  title: string;
  rows: HistoryRow[];
  footer: string;
  emptyText?: string;
  onDownload: (row: HistoryRow) => void;
}) {
  return (
    <div className="bg-surface w-full rounded-[20px] border border-manage-card-line p-[20px] lg:p-[24px]">
      <p className="font-display m-0 pb-[16px] text-[20px] leading-normal font-semibold text-onboarding-ink">Billing history · {title}</p>

      {rows.length === 0 ? (
        <p className="m-0 py-[12px] text-[13px] leading-normal text-neutral-550">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-manage-card-line">
                <th className="w-[22%] pb-[12px] text-left font-normal">
                  <p className={head}>INVOICE</p>
                </th>
                <th className="w-[15%] pb-[12px] text-left font-normal">
                  <p className={head}>DATE</p>
                </th>
                <th className="pb-[12px] text-left font-normal">
                  <p className={head}>PLAN</p>
                </th>
                <th className="w-[13%] pb-[12px] text-left font-normal">
                  <p className={head}>AMOUNT</p>
                </th>
                <th className="w-[11%] pb-[12px]">
                  <span className="sr-only">Download</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-manage-card-line">
                  <td className="py-[14px] pr-[12px]">
                    {row.invoiceNo && row.invoiceUrl ? (
                      <button type="button" onClick={() => onDownload(row)} className={`${cell} underline`}>
                        {row.invoiceNo}
                      </button>
                    ) : (
                      <span className={cell}>{row.invoiceNo || '—'}</span>
                    )}
                  </td>
                  <td className={`py-[14px] pr-[12px] ${cell}`}>{row.date}</td>
                  <td className={`py-[14px] pr-[12px] ${cell}`}>{row.plan}</td>
                  <td className="py-[14px] pr-[12px]">
                    <span className={cell}>{row.amount}</span>
                    {row.note && <span className="ml-[8px] text-[11px] font-medium text-neutral-550">{row.note}</span>}
                  </td>
                  <td className="py-[14px] text-right">
                    {row.invoiceUrl ? (
                      <button
                        type="button"
                        onClick={() => onDownload(row)}
                        className="font-partner inline-flex items-center gap-[7px] text-[14.5px] font-bold text-brand-700 hover:underline"
                      >
                        <Image src="/illustrations/plans/invoice.svg" alt="" width={17} height={17} />
                        Invoice
                      </button>
                    ) : (
                      <span className="text-[12px] text-account-placeholder">No invoice</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 pt-[16px] text-[13px] leading-normal text-neutral-550">{footer}</p>
    </div>
  );
}
