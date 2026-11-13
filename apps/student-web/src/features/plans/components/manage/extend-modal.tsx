import { formatDate, type ActivePlan } from '../../manage-data';
import { DetailRows, modalTitle, primaryButton, primaryButtonBase, Sheet, StatusBadge } from './sheet';
import { StateIcon } from './state-icon';

const body = 'm-0 text-[13px] leading-normal text-neutral-550 lg:text-[14px]';

/** Coupon-only extension of a monthly plan: the form, then its own success state. */
export function ExtendModal({
  plan,
  code,
  checking,
  error,
  result,
  onCodeChange,
  onApply,
  onClose,
}: {
  plan: ActivePlan;
  code: string;
  checking: boolean;
  error: string;
  result: { months: number | null; expiry: string | null } | null;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (result) {
    const months = result.months;
    return (
      <Sheet label="Plan extended" onClose={onClose}>
        <StatusBadge kind="ok" />
        <h2 className={modalTitle}>Plan extended</h2>
        <p className={body}>
          {code.trim().toUpperCase()} added {months ? `${months} month${months > 1 ? 's' : ''}` : 'more time'} to {plan.name} · {plan.chip}.
        </p>
        <DetailRows
          rows={[
            { label: 'Was ending on', value: plan.endDate },
            ...(result.expiry ? [{ label: 'Now ends on', value: formatDate(result.expiry), tone: 'green' as const }] : []),
          ]}
        />
        <div className="flex lg:pt-[8px]">
          <button type="button" onClick={onClose} className={primaryButton}>
            Done
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label={`Extend ${plan.name}`} onClose={() => !checking && onClose()}>
      <h2 className={modalTitle}>Extend {plan.name}</h2>
      <p className={body}>A valid coupon adds days to {plan.endDate}. No payment needed.</p>

      <div className="flex flex-col gap-[14px] lg:gap-[6px]">
        <label htmlFor="extend-coupon" className="hidden text-[12px] font-semibold text-account-ink lg:block">
          Coupon code
        </label>
        <input
          id="extend-coupon"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && code.trim() && !checking && onApply()}
          disabled={checking}
          // The dialog opens for this one field.
           
          autoFocus
          aria-label="Coupon code"
          aria-invalid={!!error}
          className={`w-full rounded-[12px] border-[1.5px] p-[14px] text-[14px] font-semibold text-account-ink uppercase outline-none lg:py-[12px] lg:font-medium ${error ? 'border-account-error-line' : 'border-account-outline focus:border-brand-700'}`}
        />
        {error && (
          <div role="alert" className="flex items-start gap-[6px]">
            <StateIcon name="alert" size={14} className="mt-[2px]" />
            <p className="m-0 text-[12px] leading-[1.5] font-medium text-account-error-text">{error}</p>
          </div>
        )}
        <p className="m-0 hidden text-[12px] leading-normal text-neutral-550 lg:block">Got a coupon from your school or a Prepzy event? Enter it here.</p>
      </div>

      <div className="flex gap-[12px] lg:pt-[8px]">
        <button
          type="button"
          onClick={onClose}
          disabled={checking}
          className="bg-surface min-w-0 flex-1 rounded-full border border-account-outline px-[22px] py-[14px] text-[14px] font-semibold text-brand-700 transition-colors hover:bg-account-soft disabled:opacity-45 lg:py-[13px] lg:text-account-ink"
        >
          Cancel
        </button>
        <button type="button" onClick={onApply} disabled={checking || !code.trim()} className={`${primaryButtonBase} py-[14px] lg:py-[13px]`}>
          {checking && <StateIcon name="loader-button" size={16} className="animate-spin" />}
          {checking ? 'Checking…' : 'Extend'}
        </button>
      </div>
    </Sheet>
  );
}
