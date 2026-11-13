import { canCancel, canExtend, canUpgrade, isFree, type ActivePlan, type HistoryRow } from '../../manage-data';
import type { PlanCardProps } from './plan-card';

const dim = 'disabled:cursor-not-allowed disabled:opacity-40';

const upgradeLabel = (plan: ActivePlan) => {
  if (isFree(plan)) return 'Upgrade';
  return plan.groupKey === 'class' ? 'Upgrade to academic year' : `Upgrade to ${plan.scopeLabel}`;
};

const shortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function MobileInvoiceRow({ row, subtitle, onDownload }: { row: HistoryRow; subtitle: string; onDownload: (row: HistoryRow) => void }) {
  return (
    <div className="flex w-full items-center gap-[10px] rounded-[12px] bg-account-soft p-[12px]">
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <p className="m-0 text-[13px] leading-normal font-semibold text-account-ink">
          {[row.invoiceNo, row.amount].filter(Boolean).join(' · ')}
          {row.note && <span className="ml-[6px] text-[11px] font-medium text-neutral-550">{row.note}</span>}
        </p>
        <p className="m-0 text-[11px] leading-normal text-neutral-550">{subtitle}</p>
      </div>
      {row.invoiceUrl ? (
        <button type="button" onClick={() => onDownload(row)} className="shrink-0 text-[12px] font-semibold text-brand-700">
          Download
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-account-placeholder">No invoice</span>
      )}
    </div>
  );
}

export function MobilePlanCard({
  plan,
  isCurrent,
  expanded,
  offline,
  refundNote,
  onToggleHistory,
  onExtend,
  onCancel,
  onUpgrade,
  onDownload,
}: PlanCardProps & { refundNote: string; onDownload: (row: HistoryRow) => void }) {
  const free = isFree(plan);
  const pill = 'min-w-0 flex-1 rounded-full py-[10px] text-[13px] font-semibold text-brand-700 transition-colors';

  return (
    <div className="bg-surface flex w-full flex-col gap-[12px] rounded-[16px] border border-account-line p-[16px]">
      <div className="flex items-center gap-[12px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <div className="flex flex-wrap items-center gap-[6px]">
            <p className="m-0 text-[15px] leading-normal font-semibold text-account-ink">{plan.name}</p>
            {isCurrent && <span className="rounded-full bg-account-gold-soft px-[8px] py-[3px] text-[10px] font-semibold text-account-gold">Current</span>}
            {free && <span className="rounded-full bg-account-ok-soft px-[8px] py-[3px] text-[10px] font-semibold text-account-ok-text">Free</span>}
          </div>
          <p className="m-0 text-[12px] leading-normal text-neutral-550">{plan.chip}</p>
        </div>
        <span className="shrink-0 rounded-full bg-success-50 px-[8px] py-[3px] text-[10px] font-semibold text-account-ok-text">Active</span>
      </div>

      <div className="flex gap-[24px] border-t border-account-line pt-[12px]">
        <div className="flex flex-col gap-[2px]">
          <p className="m-0 text-[10px] leading-normal font-semibold text-neutral-550">START</p>
          <p className="m-0 text-[13px] leading-normal font-semibold text-account-ink">{plan.startDate || '—'}</p>
        </div>
        <div className="flex flex-col gap-[2px]">
          <p className="m-0 text-[10px] leading-normal font-semibold text-neutral-550">ENDS</p>
          <p className="m-0 text-[13px] leading-normal font-semibold text-account-ink">{plan.endDate || '—'}</p>
        </div>
      </div>

      {free ? (
        canUpgrade(plan) && (
          <button
            type="button"
            onClick={onUpgrade}
            disabled={offline}
            className={`text-on-brand w-full rounded-full bg-brand-700 py-[10px] text-[13px] font-semibold transition-colors hover:bg-account-hover ${dim}`}
          >
            Upgrade
          </button>
        )
      ) : (
        <div className="flex gap-[10px]">
          {canExtend(plan) && (
            <button type="button" onClick={onExtend} disabled={offline} className={`${pill} bg-brand-75 hover:bg-manage-chip-hover ${dim}`}>
              Extend plan
            </button>
          )}
          <button
            type="button"
            onClick={onToggleHistory}
            disabled={offline}
            aria-expanded={expanded}
            className={`${pill} border border-account-outline hover:bg-account-soft ${dim}`}
          >
            {expanded ? 'Hide invoices' : 'Invoices'}
          </button>
        </div>
      )}

      {!free && canUpgrade(plan) && (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={offline}
          className={`text-on-brand w-full rounded-full bg-brand-700 px-[20px] py-[10px] text-[14px] font-semibold transition-colors hover:bg-account-hover ${dim}`}
        >
          {upgradeLabel(plan)}
        </button>
      )}

      {canCancel(plan) && (
        <div className="flex justify-center pt-[2px]">
          <button type="button" onClick={onCancel} disabled={offline} className={`text-[13px] font-semibold text-danger-600 ${dim}`}>
            Cancel plan
          </button>
        </div>
      )}

      {free && (
        <div className="rounded-[14px] bg-account-soft px-[16px] py-[14px]">
          <p className="m-0 text-[12px] leading-[1.5] text-neutral-550">No invoices yet. {plan.name} is free.</p>
        </div>
      )}

      {!free && expanded && (
        <>
          {plan.history.length === 0 && <p className="m-0 text-[12px] leading-normal text-neutral-550">No invoices for this plan yet.</p>}
          {plan.history.map((row) => (
            <MobileInvoiceRow key={row.key} row={row} subtitle={row.date} onDownload={onDownload} />
          ))}
          <p className="m-0 text-[11px] leading-normal text-neutral-550">{refundNote}</p>
        </>
      )}

      {plan.hasPendingPlan && plan.pendingStartDate && (
        <div className="rounded-[12px] border border-account-ok-line bg-success-50 px-[14px] py-[10px]">
          <p className="m-0 text-[12px] leading-normal font-medium text-account-ok-text">
            ✓&nbsp; Plan will be renewed on {shortDate(plan.pendingStartDate)}.
          </p>
        </div>
      )}
    </div>
  );
}

export function MobileExpiredHistory({ rows, onDownload }: { rows: HistoryRow[]; onDownload: (row: HistoryRow) => void }) {
  return (
    <div className="bg-surface flex w-full flex-col gap-[10px] rounded-[16px] border border-account-line px-[17px] py-[16px]">
      <p className="m-0 text-[14px] leading-normal font-semibold text-account-ink">Billing history · expired plans</p>
      {rows.map((row) => (
        <MobileInvoiceRow key={row.key} row={row} subtitle={row.plan} onDownload={onDownload} />
      ))}
      <p className="m-0 text-[12px] leading-[1.5] text-neutral-550">Plans that have ended stay here with their invoices. Buy again from View plans.</p>
    </div>
  );
}
