'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, TrendingUp, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useActivePlan, useCurrentUser } from '@/features/auth';
import { DEFAULT_EXAM, findExam, getExam, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { isPlanCategory, plansApi } from '../api';
import { formatInr, formatShortDate } from '../money';
import { Confetti } from './confetti';
import { useModalBehaviour } from './modal';

/** Same keys as the previous app, so a code from a referral link or a first visit there carries over. */
export const REFERRAL_CODE_KEY = 'prepzy_referral_code';
export const FIRST_VISIT_KEY = 'first_visit_pre_dashboard';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode: nothing to remember.
  }
};

function Banner({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'mt-2.5 flex items-start gap-2 rounded-sm border px-4 py-2.5 text-left',
        tone === 'ok' && 'border-plan-ok-line bg-plan-ok-soft text-plan-check',
        tone === 'error' && 'border-plan-err-line bg-plan-alert-soft text-plan-err-text',
        tone === 'info' && 'bg-brand-soft border-brand-100 text-brand',
      )}
    >
      {tone === 'ok' && <Check aria-hidden className="text-plan-applied mt-1 size-3.5 shrink-0" strokeWidth={2.4} />}
      {tone === 'error' && (
        <span className="bg-plan-alert text-on-brand mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold">!</span>
      )}
      <p className="m-0 text-[13.5px] leading-[19px] font-semibold">{children}</p>
    </div>
  );
}

function CodeInput({
  value,
  placeholder,
  applied,
  busy,
  onChange,
  onApply,
}: {
  value: string;
  placeholder: string;
  applied: boolean;
  busy: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={applied}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cx(
          'focus:border-brand placeholder:text-neutral-350 min-w-0 flex-1 rounded-md border px-4 py-2.5 text-[14px] text-neutral-800 outline-none',
          applied ? 'border-plan-ok-line bg-plan-ok-soft' : 'border-plan-input-line bg-plan-input',
        )}
      />
      <button
        type="button"
        onClick={onApply}
        disabled={busy || applied || !value.trim()}
        className={cx('text-on-brand shrink-0 rounded-md px-6 py-2.5 text-[14px] font-bold whitespace-nowrap disabled:opacity-50', applied ? 'bg-plan-applied' : 'bg-brand')}
      >
        {busy ? 'Applying...' : applied ? 'Applied' : 'Apply'}
      </button>
    </>
  );
}

function LimitsDialog({ exam, onClose }: { exam: ExamConfig; onClose: () => void }) {
  useModalBehaviour(onClose);
  const limits = useQuery({ queryKey: ['plans', 'signup-limits', exam.examId], queryFn: () => plansApi.signupLimits(exam.examId) });
  const cell = (value: number | null) => (value == null ? 'Unlimited' : String(value));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="limits-title" className="bg-surface flex max-h-[70vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl shadow-lg">
        <div className="flex shrink-0 items-center justify-between px-6 py-4">
          <h3 id="limits-title" className="text-ink font-display m-0 text-xl leading-tight font-extrabold">
            View usage limits
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="bg-plan-tab flex size-8 items-center justify-center rounded-full text-neutral-500">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6">
          <div className="border-plan-table-line overflow-hidden rounded-lg border">
            <div className="bg-plan-table-head grid grid-cols-[1fr_80px_80px] items-center px-4 py-3">
              <span className="text-plan-table-label text-[9px] font-bold tracking-[0.12em] uppercase">Feature</span>
              <span className="text-plan-table-label text-center text-[9px] font-bold tracking-[0.12em] uppercase">Basic</span>
              <span className="text-plan-table-topper text-center text-[9px] font-bold tracking-[0.12em] uppercase">Topper</span>
            </div>
            {(limits.isPending ? [] : (limits.data ?? [])).map((row) => (
              <div key={row.name} className="border-plan-table-row grid grid-cols-[1fr_80px_80px] items-center border-t px-4 py-3">
                <span className="text-plan-table-text font-display text-[12px] leading-[18px] font-medium">{row.name}</span>
                <span className="text-plan-table-text font-display text-center text-[13px] font-semibold">{cell(row.free)}</span>
                <span className="text-plan-table-topper font-display text-center text-[13px] font-bold">{cell(row.premium)}</span>
              </div>
            ))}
            {limits.isPending &&
              [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-plan-table-row grid grid-cols-[1fr_80px_80px] items-center border-t px-4 py-3">
                  <span className="bg-plan-tab h-3.5 w-3/4 rounded-sm" />
                  <span className="bg-plan-tab mx-auto h-3.5 w-8 rounded-sm" />
                  <span className="bg-plan-tab mx-auto h-3.5 w-8 rounded-sm" />
                </div>
              ))}
          </div>
          <p className="text-plan-table-note m-0 py-4 text-[11px] leading-[17px]">
            Free on Topper for 1 month. After that, Basic keeps everything with smaller limits. Every limit resets at 5:00 AM each day.
          </p>
        </div>
        <div className="shrink-0 px-6 pb-6">
          <button type="button" onClick={onClose} className="bg-plan-table-topper text-on-brand w-full rounded-md py-[13px] text-[14px] font-bold">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingDialog({ exam, classId, planId, onClose }: { exam: ExamConfig; classId: number; planId: number; onClose: () => void }) {
  useModalBehaviour(onClose);
  const prices = useQuery({ queryKey: ['plans', 'signup-prices', classId, planId], queryFn: () => plansApi.signupPrices(classId, planId) });
  const list = prices.data ?? [];
  const monthly = list.find((p) => p.durationMonths === 1);
  const academic = list.find((p) => p.durationMonths !== 1 && p.durationMonths !== 0) ?? list.find((p) => p.durationMonths !== 1);
  const title = list[0]?.title ?? '';
  const competitive = exam.category === 'competitive';
  const bundle = list[0]?.bundled ? ' + CBSE' : '';
  const year = list[0]?.year;
  const names = competitive
    ? { basic: `Basic NEET${bundle}`, monthly: `Topper NEET${bundle} Monthly`, yearly: `Topper NEET${year != null ? ` ${year}` : ''}${bundle}` }
    : { basic: `${title} Basic`, monthly: `${title} Topper Monthly`, yearly: `${title} Topper Academic Year` };
  const row = (name: string, price: number, cost: number | null, highlight = false) => (
    <div className={cx('flex items-center justify-between rounded-lg px-4 py-3.5', highlight ? 'border-brand-800 bg-plan-tile border-2' : 'bg-plan-panel')}>
      <span className="text-ink font-display text-[17px] font-bold lg:text-lg">{name}</span>
      <span className="flex items-center gap-2">
        <span className="text-ink font-display text-xl font-extrabold lg:text-[23px]">{formatInr(price)}</span>
        {cost != null && cost > price && <span className="text-neutral-350 text-[12px] line-through">{formatInr(cost)}</span>}
      </span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-2.5" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Pricing" className="bg-surface flex max-h-[90vh] w-[95%] max-w-lg flex-col overflow-hidden rounded-lg shadow-lg lg:w-full">
        <div className="flex-1 overflow-y-auto p-[30px]">
          {prices.isPending && <p className="text-neutral-500 mt-4 text-sm">Loading prices…</p>}
          {prices.isError && (
            <div className="border-border mt-6 rounded-lg border p-5 text-center">
              <p className="text-ink m-0 text-[15px] font-bold">Couldn’t load plans</p>
              <button type="button" onClick={() => prices.refetch()} className="bg-brand-800 text-on-brand mt-3 rounded-md px-4 py-2 text-[14px] font-bold">
                Retry
              </button>
            </div>
          )}
          {prices.isSuccess && list.length === 0 && <p className="text-neutral-500 mt-6 text-center text-[14px]">No plans available for this class yet.</p>}
          {list.length > 0 && (
            <>
              <p className="text-ink font-display mt-4 text-[19px] leading-5 font-bold lg:text-xl">What it costs after 1 month</p>
              <div className="mt-4 flex flex-col gap-3">
                {row(names.basic, 0, null)}
                {monthly && row(names.monthly, monthly.price, monthly.costPrice)}
                {academic && academic !== monthly && row(names.yearly, academic.price, academic.costPrice, true)}
              </div>
              <p className="text-plan-applied mt-3 text-[12px] font-bold">Your first month is free. You pay nothing today.</p>
              <button type="button" onClick={onClose} className="bg-brand-800 text-on-brand mt-3 w-full rounded-lg py-3.5 text-[15px] font-bold">
                Got it
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Rings({ className }: { className?: string }) {
  return (
    <div className={cx('relative flex h-[150px] w-full items-center justify-center', className)}>
      <div className="bg-plan-ring-1 flex size-[130px] items-center justify-center rounded-full">
        <div className="bg-plan-ring-2 flex size-24 items-center justify-center rounded-full">
          <div className="bg-plan-ring-3 flex size-16 items-center justify-center rounded-full">
            <Check aria-hidden className="text-plan-check size-8" strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** /welcome — shown once after sign-up: the free Topper month, a coupon or referral code, then the dashboard. */
export function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useCurrentUser();
  const exam = getExam(params.get('exam')) ?? findExam(user.data?.targetExam) ?? getExam(DEFAULT_EXAM)!;
  const plan = useActivePlan(exam);
  const category = isPlanCategory(exam.category) ? exam.category : 'board';
  const dashboard = routes.dashboard(exam.slug);
  const signupPlan = useQuery({ queryKey: ['plans', 'signup-plan', exam.examId], queryFn: () => plansApi.signupPlanId(exam.examId) });
  const planId = signupPlan.data ?? plan.data?.planId ?? null;
  const classId = Number(params.get('class_id')) || plan.data?.classId || null;
  const expiry = plan.data?.expiryDate ?? read('prepzy-plan-expiry-date');

  const [tab, setTab] = useState<'coupon' | 'referral'>('coupon');
  const [coupon, setCoupon] = useState({ code: '', busy: false, error: '', months: null as number | null, expiry: null as string | null, applied: false });
  const [referral, setReferral] = useState({ code: '', busy: false, error: '', applied: false, credit: null as number | null });
  const [benefit, setBenefit] = useState<{ referrerName: string; joiningCredit: number } | null>(null);
  const [dialog, setDialog] = useState<'limits' | 'pricing' | null>(null);

  // Second visit: straight to the dashboard (the previous app's behaviour).
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (read(FIRST_VISIT_KEY)) router.replace(dashboard);
    else write(FIRST_VISIT_KEY, 'true');
  }, [router, dashboard]);

  // Back button leaves onboarding for the dashboard.
  useEffect(() => {
    const onPop = () => router.replace(dashboard);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router, dashboard]);

  const applyReferral = async (override?: string) => {
    const code = (override ?? referral.code).trim();
    if (!code) return;
    setReferral((state) => ({ ...state, code, busy: true, error: '', applied: false }));
    try {
      const credit = await plansApi.applyReferral(code, exam.examId);
      write(REFERRAL_CODE_KEY, null);
      setReferral((state) => ({ ...state, busy: false, applied: true, credit }));
    } catch (error) {
      setReferral((state) => ({ ...state, busy: false, error: userMessage(error, 'Invalid referral code') }));
    }
  };

  // A code that arrived through a referral link is checked and applied without a click.
  const autoApplied = useRef(false);
  useEffect(() => {
    if (autoApplied.current) return;
    autoApplied.current = true;
    void (async () => {
      const already = await plansApi.referralStatus().catch(() => false);
      if (already) {
        setReferral((state) => ({ ...state, applied: true }));
        write(REFERRAL_CODE_KEY, null);
        return;
      }
      const stored = read(REFERRAL_CODE_KEY);
      if (!stored) return;
      setReferral((state) => ({ ...state, code: stored }));
      setTab('referral');
      const valid = await plansApi.validateReferral(stored).catch(() => null);
      if (valid) {
        setBenefit(valid);
        await applyReferral(stored);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, []);

  const applyCoupon = async () => {
    const code = coupon.code.trim();
    if (!code) return;
    setCoupon((state) => ({ ...state, busy: true, error: '', applied: false }));
    try {
      const result = await plansApi.extend(category, code, category === 'competitive' ? planId : null);
      setCoupon((state) => ({ ...state, busy: false, applied: true, months: result.months, expiry: result.expiryDate }));
    } catch (error) {
      setCoupon((state) => ({ ...state, busy: false, error: userMessage(error, 'Invalid coupon code') }));
    }
  };

  const ends = expiry ? `Ends ${formatShortDate(expiry)}` : 'Free for 1 month';
  const tabClass = (active: boolean) =>
    cx(
      'relative flex-1 rounded-[10px] px-4 py-2 text-[13.5px] font-bold whitespace-nowrap transition-all',
      active ? 'bg-surface text-brand shadow-[0_2px_6px_rgba(61,52,139,0.15)]' : 'text-plan-tab-text bg-transparent',
    );

  return (
    <div data-theme={exam.theme} className="bg-plan-welcome h-dvh overflow-hidden lg:flex">
      <Confetti pieces={130} />
      <main className="flex h-dvh w-full flex-col">
        <div className="flex-1 overflow-y-auto px-6 pt-0 pb-8 sm:px-10 lg:py-10">
          <div className="flex min-h-full items-start lg:items-center">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex flex-col items-center text-center">
                <div className="from-brand-500 via-brand-800 to-brand relative -mx-6 w-[calc(100%+48px)] overflow-hidden rounded-b-[28px] bg-linear-155 px-6 pt-6 pb-16 lg:hidden">
                  <Image src="/brand/logo-white.png" alt="Prepzy" width={110} height={37} className="relative z-10 h-auto w-[110px]" />
                  <Rings className="z-10" />
                  <h1 className="font-display text-on-brand relative z-10 text-[28px] font-bold">You&apos;re all set!</h1>
                  <p className="font-display text-on-brand/75 relative z-10 mt-1 text-[15px]">Your AI teachers are ready. Everything is set up for you!</p>
                </div>
                <div className="hidden w-full flex-col items-center lg:flex">
                  <Rings />
                  <p className="text-ink font-display text-[32px] font-bold">You&apos;re all set!</p>
                  <p className="font-display mt-1 text-md text-neutral-500">Your AI teachers are ready. Everything is set up for you!</p>
                </div>

                <div className="bg-surface shadow-card relative z-10 -mt-10 w-full rounded-lg px-3 py-3 text-left lg:mt-6 lg:w-[720px]">
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <div className="flex items-center gap-3">
                      <span className="bg-accent-400 flex size-11 shrink-0 items-center justify-center rounded-md">
                        <TrendingUp aria-hidden className="text-on-brand size-5" strokeWidth={2.2} />
                      </span>
                      <div>
                        <p className="text-ink font-display m-0 text-lg font-bold">Topper plan active</p>
                        <p className="text-plan-fresh font-display m-0 text-[15px] font-semibold">Free for 1 month</p>
                      </div>
                    </div>
                    <span className="border-plan-line bg-plan-panel hidden items-center gap-1.5 rounded-sm border-2 px-3 py-1.5 sm:flex">
                      <CalendarDays aria-hidden className="text-plan-deep size-3.5" />
                      <span className="text-plan-deep text-[12px] font-semibold whitespace-nowrap">{ends}</span>
                    </span>
                  </div>
                  <div className="border-plan-line border-t pt-2">
                    <p className="text-foreground-soft m-0 text-[13px] leading-normal">
                      Video lectures, smart tests, past papers and Atlas, with 10× the daily limits of Basic.
                    </p>
                  </div>
                  <span className="bg-plan-panel mt-3 flex items-center gap-1.5 rounded-sm px-3 py-1.5 sm:hidden">
                    <CalendarDays aria-hidden className="text-plan-deep size-3.5" />
                    <span className="text-plan-deep text-[12px] font-semibold whitespace-nowrap">{ends}</span>
                  </span>
                </div>
              </div>

              <div className="bg-surface shadow-card mx-auto mt-4 w-full rounded-lg p-4 text-center lg:w-[720px]">
                <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
                  <div role="tablist" aria-label="Code type" className="bg-plan-tab flex shrink-0 rounded-[10px] p-1">
                    <button type="button" role="tab" aria-selected={tab === 'coupon'} onClick={() => setTab('coupon')} className={tabClass(tab === 'coupon')}>
                      Coupon code
                    </button>
                    <button type="button" role="tab" aria-selected={tab === 'referral'} onClick={() => setTab('referral')} className={tabClass(tab === 'referral')}>
                      Referral code
                      {benefit && !referral.applied && tab !== 'referral' && <span className="bg-accent-400 absolute -top-1 -right-1 size-2.5 rounded-full" />}
                    </button>
                  </div>
                  {tab === 'coupon' ? (
                    <CodeInput
                      value={coupon.code}
                      placeholder="Enter coupon code"
                      applied={coupon.applied}
                      busy={coupon.busy}
                      onChange={(code) => setCoupon((state) => ({ ...state, code, applied: false, error: '' }))}
                      onApply={applyCoupon}
                    />
                  ) : (
                    <CodeInput
                      value={referral.code}
                      placeholder="Enter referral code"
                      applied={referral.applied}
                      busy={referral.busy}
                      onChange={(code) => setReferral((state) => ({ ...state, code, applied: false, error: '' }))}
                      onApply={() => applyReferral()}
                    />
                  )}
                </div>
                {tab === 'referral' && benefit && !referral.applied && (
                  <Banner tone="info">
                    🎉 You have a referral code from <span className="font-bold">{benefit.referrerName}</span> — apply it to get ₹
                    {benefit.joiningCredit} in credits!
                  </Banner>
                )}
                {tab === 'coupon' && coupon.applied && coupon.months && coupon.expiry && (
                  <Banner tone="ok">
                    {coupon.months} extra months added. Your free plan now runs till <span>{formatShortDate(coupon.expiry)}</span>.
                  </Banner>
                )}
                {tab === 'coupon' && coupon.error && <Banner tone="error">{coupon.error}</Banner>}
                {tab === 'referral' && referral.applied && referral.credit != null && <Banner tone="ok">₹{referral.credit} credited to your wallet!</Banner>}
                {tab === 'referral' && referral.error && <Banner tone="error">{referral.error}</Banner>}
                <p className="m-0 mt-3 text-[12px] text-neutral-500">
                  {tab === 'coupon'
                    ? 'Your first plan is already free. This coupon code will extend your plan validity.'
                    : "Enter a friend's referral code and you'll both earn Prepzy coins."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.replace(dashboard)}
                className="bg-accent-400 text-ink font-display lg:bg-brand lg:text-on-brand mx-auto mt-4 block w-full rounded-lg py-3.5 text-center text-md font-bold hover:shadow-lg lg:w-[720px]"
              >
                Go to my dashboard
              </button>
              <div className="mt-3 flex items-center justify-center gap-6">
                <button type="button" onClick={() => setDialog('limits')} className="text-brand text-[14px] font-bold hover:underline">
                  See Usage limits
                </button>
                <button
                  type="button"
                  onClick={() => setDialog('pricing')}
                  disabled={!classId || !planId}
                  className="text-brand text-[14px] font-bold hover:underline"
                >
                  See pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      {dialog === 'limits' && <LimitsDialog exam={exam} onClose={() => setDialog(null)} />}
      {dialog === 'pricing' && classId && planId && <PricingDialog exam={exam} classId={classId} planId={planId} onClose={() => setDialog(null)} />}
    </div>
  );
}
