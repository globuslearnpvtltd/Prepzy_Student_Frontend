import { StateIcon } from './state-icon';

const Bar = ({ className }: { className: string }) => <div className={`rounded-[6px] bg-account-bone ${className}`} />;

function CardSkeleton() {
  return (
    <div className="bg-surface flex flex-col gap-[16px] rounded-[20px] border border-manage-card-line p-[24px] shadow-[0px_6px_18px_0px_rgba(36,29,82,0.05)] lg:flex-row lg:items-center lg:gap-[30px]">
      <div className="flex flex-col gap-[10px] lg:w-[290px]">
        <Bar className="h-[15px] w-[200px]" />
        <div className="flex gap-[6px]">
          <Bar className="h-[18px] w-[110px]" />
          <Bar className="h-[18px] w-[45px]" />
        </div>
      </div>
      <div className="flex w-[130px] flex-col gap-[10px]">
        <Bar className="h-[8px] w-[65px]" />
        <Bar className="h-[14px] w-[92px]" />
      </div>
      <div className="flex w-[264px] items-center gap-[12px]">
        <div className="flex flex-col gap-[10px]">
          <Bar className="h-[8px] w-[53px]" />
          <Bar className="h-[14px] w-[99px]" />
        </div>
        <Bar className="h-[36px] w-[90px] rounded-[11px]" />
      </div>
      <div className="flex w-[110px] flex-col gap-[10px]">
        <Bar className="h-[8px] w-[41px]" />
        <div className="flex h-[28px] w-[58px] items-center rounded-full bg-account-bone pl-[10px]">
          <span className="size-[6px] rounded-full bg-manage-active" />
        </div>
      </div>
      <span className="flex-1" />
      <Bar className="h-[10px] w-[86px]" />
      <Bar className="size-[40px] rounded-full" />
    </div>
  );
}

function MobileCardSkeleton() {
  return (
    <div className="bg-surface flex flex-col gap-[12px] rounded-[16px] border border-account-line p-[16px]">
      <div className="flex items-center gap-[12px]">
        <div className="flex flex-1 flex-col gap-[8px]">
          <Bar className="h-[14px] w-[170px]" />
          <Bar className="h-[9px] w-[110px]" />
        </div>
        <Bar className="h-[18px] w-[48px] rounded-full" />
      </div>
      <div className="flex gap-[24px] border-t border-account-line pt-[12px]">
        <div className="flex flex-col gap-[6px]">
          <Bar className="h-[7px] w-[32px]" />
          <Bar className="h-[11px] w-[70px]" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <Bar className="h-[7px] w-[28px]" />
          <Bar className="h-[11px] w-[74px]" />
        </div>
      </div>
      <div className="flex gap-[10px]">
        <Bar className="h-[40px] flex-1 rounded-full" />
        <Bar className="h-[40px] flex-1 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Bar className="h-[9px] w-[80px]" />
      </div>
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-[16px] lg:hidden" aria-busy="true" aria-label="Loading your plans">
        <div className="flex gap-[8px]">
          <Bar className="h-[32px] w-[95px] rounded-full" />
          <div className="h-[32px] w-[61px] rounded-full border border-account-outline" />
          <div className="h-[32px] w-[83px] rounded-full border border-account-outline" />
        </div>
        <Bar className="h-[8px] w-[92px]" />
        <MobileCardSkeleton />
        <MobileCardSkeleton />
      </div>
      <div className="hidden flex-col gap-[24px] lg:flex" aria-busy="true" aria-label="Loading your plans">
        <div className="flex items-center gap-[8px]">
          <Bar className="h-[30px] w-[95px] rounded-full" />
          <div className="flex h-[30px] w-[60px] items-center justify-center rounded-full border border-account-outline">
            <Bar className="h-[6px] w-[30px]" />
          </div>
          <div className="flex h-[30px] w-[80px] items-center justify-center rounded-full border border-account-outline">
            <Bar className="h-[6px] w-[50px]" />
          </div>
          <span className="flex-1" />
          <Bar className="h-[34px] w-[105px] rounded-full" />
        </div>
        <Bar className="h-[8px] w-[92px]" />
        <CardSkeleton />
        <div className="bg-surface flex flex-col gap-[20px] rounded-[20px] border border-manage-card-line p-[24px]">
          <Bar className="h-[14px] w-[257px]" />
          <div className="flex gap-[20%]">
            <Bar className="h-[8px] w-[45px]" />
            <Bar className="h-[8px] w-[27px]" />
            <Bar className="h-[8px] w-[29px]" />
          </div>
          <Bar className="h-[11px] w-full" />
          <Bar className="h-[9px] w-[417px] max-w-full" />
        </div>
        <CardSkeleton />
      </div>
    </>
  );
}

export function OfflineBanner({ savedAt, onRetry }: { savedAt: string | null; onRetry: () => void }) {
  return (
    <div role="status" className="flex items-center gap-[10px] border-b border-account-offline-line bg-warning-50 px-[16px] py-[14px] md:px-[40px] lg:px-[60px]">
      <StateIcon name="offline" size={18} />
      <p className="m-0 min-w-0 flex-1 text-[13px] leading-[1.5] font-medium text-account-offline-text">
        You’re offline.{savedAt ? ` Showing plans as saved at ${savedAt}.` : ''} Extend, buy and cancel need internet.
      </p>
      <button type="button" onClick={onRetry} className="shrink-0 text-[13px] font-semibold text-brand-700">
        Retry
      </button>
    </div>
  );
}

export function PlansErrorState({ onRetry, onSupport }: { onRetry: () => void; onSupport: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-[480px] flex-col items-center gap-[14px] py-[60px] text-center">
      <div className="flex size-[56px] items-center justify-center rounded-full bg-danger-50">
        <StateIcon name="error" size={26} />
      </div>
      <p className="m-0 text-[20px] leading-[1.5] font-bold text-account-ink">We couldn’t load your plans</p>
      <p className="m-0 text-[14px] leading-[1.5] text-neutral-550">This is on our side. Your plans and invoices are safe.</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-on-brand flex items-center gap-[8px] rounded-full bg-brand-700 px-[26px] py-[13px] text-[14px] font-semibold transition-colors hover:bg-account-hover"
      >
        <StateIcon name="retry" size={16} />
        Try again
      </button>
      <button type="button" onClick={onSupport} className="text-[13px] font-semibold text-brand-700 hover:underline">
        Contact support
      </button>
    </div>
  );
}

export interface InvoiceToastState {
  kind: 'loading' | 'done' | 'error';
  invoiceNo: string | null;
}

export function InvoiceToast({ toast, onOpen, onRetry }: { toast: InvoiceToastState; onOpen: () => void; onRetry: () => void }) {
  const label = toast.invoiceNo ? `invoice ${toast.invoiceNo}` : 'invoice';
  const icon = toast.kind === 'loading' ? 'loader-toast' : toast.kind === 'done' ? 'toast-ok' : 'toast-error';
  return (
    <div
      className="fixed bottom-[24px] left-1/2 z-[1200] w-[calc(100%-40px)] max-w-[400px] -translate-x-1/2 leading-normal lg:top-[88px] lg:bottom-auto lg:max-w-[468px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-[10px] rounded-[14px] bg-account-ink py-[14px] pr-[18px] pl-[16px] shadow-[0px_16px_44px_0px_rgba(31,26,56,0.18)]">
        <StateIcon name={icon} size={18} className={toast.kind === 'loading' ? 'animate-spin' : ''} />
        <p className="text-on-brand m-0 min-w-0 flex-1 text-[13px] leading-[1.5] font-medium">
          {toast.kind === 'loading' && `Downloading ${label}…`}
          {toast.kind === 'done' && (
            <>
              <span className="lg:hidden">Invoice saved to Downloads</span>
              <span className="hidden lg:inline">{`${label.charAt(0).toUpperCase()}${label.slice(1)} downloaded`}</span>
            </>
          )}
          {toast.kind === 'error' && (
            <>
              <span className="lg:hidden">Couldn’t download. Check your connection.</span>
              <span className="hidden lg:inline">Couldn’t download the invoice. Check your connection.</span>
            </>
          )}
        </p>
        {toast.kind === 'done' && (
          <button type="button" onClick={onOpen} className="shrink-0 text-[13px] font-semibold text-account-toast-action">
            Open
          </button>
        )}
        {toast.kind === 'error' && (
          <button type="button" onClick={onRetry} className="shrink-0 text-[13px] font-semibold text-account-toast-action">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
