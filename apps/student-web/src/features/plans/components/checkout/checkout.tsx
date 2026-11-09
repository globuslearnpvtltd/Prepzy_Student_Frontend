'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, Check, Stethoscope, Target } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { rememberExam, useCurrentUser } from '@/features/auth';
import { EXAMS, findExam } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { StatusScreen } from '@/shared/layout/status-screens';
import { userMessage } from '@/shared/lib/errors';
import { isPlanCategory, plansApi } from '../../api';
import {
  accessLabel,
  buildSections,
  sortedClassTitles,
  titleCase,
  toPlans,
  variantValidityLabel,
  withGst,
  yearVariants,
  type ApiVariant,
} from '../../catalog';
import { useCatalog, useCoupons, useFeatureLimits } from '../../hooks';
import { formatPlanDate } from '../../money';
import { usePayment } from '../../use-payment';
import { WarningDialog } from '../modal';
import { ComparePlans } from './compare-plans';
import { PaymentFailed, PaymentPending, PaymentSuccess } from './outcome-overlays';
import { BackButton, EmptyPlans, ExamCard, Eyebrow, MobileActionBar, OptionCard, PlanCard, PlanSkeleton, Switch } from './primitives';
import { ReviewStep, type CouponState } from './review-step';

/** Exam picker cards, in the order the design lays them out. JEE has no catalog yet, so it shows disabled. */
const EXAM_CARDS: { key: string; label: string; description: string; icon: ReactNode }[] = [
  { key: EXAMS.neet.examSlice, label: 'NEET', description: 'Medical entrance exam for your dream career.', icon: <Stethoscope size={18} /> },
  { key: EXAMS.cbse.examSlice, label: 'CBSE', description: 'Build a strong foundation for your board exams.', icon: <BookOpen size={18} /> },
  { key: 'jee', label: 'JEE', description: 'Crack the exam, get into your dream college.', icon: <Target size={18} /> },
];

const NO_COUPON: CouponState = { input: '', applied: null, discount: 0, error: '', checking: false };

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface text-plan-ink min-h-dvh">
      <div className="mx-auto w-full max-w-[1440px] px-5 pt-6 pb-[120px] md:px-8 md:pt-8 lg:pt-10 lg:pb-[72px]">{children}</div>
    </div>
  );
}

/** /[exam]/plans/purchase — choose exam, class or target year and a plan, then review and pay. */
export function Checkout() {
  const routeExam = useExam();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const catalog = useCatalog();
  const limits = useFeatureLimits();
  const coupons = useCoupons();

  const examParam = params.get('exam');
  const [examKey, setExamKey] = useState(() => findExam(examParam)?.examSlice ?? (examParam === 'jee' ? 'jee' : routeExam.examSlice));
  const [classTitle, setClassTitle] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addBoards, setAddBoards] = useState(false);
  const [priceId, setPriceId] = useState<number | null>(null);
  const [step, setStep] = useState<'plan' | 'review'>('plan');
  const [allLimits, setAllLimits] = useState(false);
  const [coupon, setCoupon] = useState<CouponState>(NO_COUPON);

  const exams = useMemo(() => catalog.data ?? [], [catalog.data]);
  const activeExam = exams.find((entry) => entry.examKey === examKey) ?? null;
  const category = activeExam?.category ?? null;
  const byYear = category === 'competitive';

  // Preselect the class from ?CLASSID= (old links), else the student's own class, once the catalog lands.
  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (preselected || !catalog.data || examParam) return;
    setPreselected(true);
    const classParam = params.get('CLASSID') ?? params.get('class');
    const streamParam = Number(params.get('stream_id'));
    const targetClass = classParam ? Number(classParam) : user.data?.classId;
    if (!targetClass) return;
    const ordered = classParam ? catalog.data : catalog.data.filter((entry) => entry.examKey === routeExam.examSlice);
    for (const entry of ordered) {
      const match = entry.variants.find(
        (variant) => variant.class_id === targetClass && (!streamParam || variant.stream_id === streamParam),
      );
      if (match) {
        setExamKey(entry.examKey);
        setClassTitle(match.class_title);
        setVariantId(match.variant_id);
        return;
      }
    }
  }, [preselected, catalog.data, examParam, params, user.data?.classId, routeExam.examSlice]);

  const classTitles = useMemo(() => sortedClassTitles(activeExam?.variants ?? []), [activeExam]);
  const years = useMemo(() => (byYear ? yearVariants(activeExam?.variants ?? []) : []), [byYear, activeExam]);
  const activeClass = byYear ? null : (classTitle ?? classTitles[0] ?? null);
  const classVariants = useMemo(
    () => (activeExam?.variants ?? []).filter((variant) => variant.class_title === activeClass),
    [activeExam, activeClass],
  );
  const streams = classVariants.filter((variant) => variant.stream_id !== null);
  const options = byYear ? years : (activeExam?.variants ?? []);
  const variant: ApiVariant | null =
    options.find((option) => option.variant_id === variantId) ?? (byYear ? years[0] : classVariants[0]) ?? null;

  const plans = useMemo(() => {
    if (!variant) return [];
    const source = variant.has_combo ? variant.plans.filter((plan) => plan.is_combo === addBoards) : variant.plans;
    return toPlans(source, category, variant.target_year ?? null);
  }, [variant, addBoards, category]);
  const sections = useMemo(() => buildSections(category, plans, limits.data?.[examKey] ?? []), [category, plans, limits.data, examKey]);
  const chosen = plans.find((plan) => plan.priceId === priceId) ?? plans[0] ?? null;

  const contextLabel = variant
    ? byYear
      ? `NEET ${variant.target_year}${addBoards ? ' + CBSE' : ''}`
      : `${titleCase(variant.class_title)}${variant.stream_name ? ` · ${variant.stream_name}` : ''}`
    : '';
  const scope = chosen?.isCombo ? 'NEET + CBSE' : byYear ? 'NEET' : 'CBSE';
  const purchasedExam = findExam(examKey);

  const payment = usePayment({
    category: isPlanCategory(category) ? category : 'board',
    coupon: coupon.applied,
    describe: (plan) => `${plan.name} · ${plan.durationName} · ${contextLabel}`,
    prefill: { name: user.data?.firstName ?? '', contact: user.data?.phone ?? '', email: user.data?.email ?? '' },
  });

  const resetPlan = () => {
    setPriceId(null);
    setAllLimits(false);
    setCoupon(NO_COUPON);
    payment.clearFailed();
  };

  const goToReview = (priceIdToReview: number) => {
    setPriceId(priceIdToReview);
    setStep('review');
    setAllLimits(false);
    payment.clearFailed();
    window.scrollTo?.({ top: 0 });
  };

  const backToPlans = () => {
    payment.clearFailed();
    setStep('plan');
    window.scrollTo?.({ top: 0 });
  };

  const applyCoupon = async (code?: string) => {
    const value = (code ?? coupon.input).trim();
    if (!value) return;
    setCoupon((state) => ({ ...state, input: value, checking: true, error: '' }));
    try {
      const discount = await plansApi.applyCoupon(value);
      setCoupon({ input: value, applied: value, discount, error: '', checking: false });
    } catch (error) {
      setCoupon((state) => ({ ...state, applied: null, discount: 0, checking: false, error: userMessage(error, "Couldn't check that coupon. Try again.") }));
    }
  };

  /** Fresh subscription state everywhere, then the purchased exam's dashboard. */
  const openDashboard = async () => {
    const slug = purchasedExam?.slug ?? routeExam.slug;
    rememberExam(slug);
    await queryClient.invalidateQueries();
    router.replace(routes.dashboard(slug));
  };

  const overlays = (
    <>
      {payment.succeeded && (
        <PaymentSuccess
          planName={payment.succeeded.name}
          courseAccess={contextLabel || 'Your course'}
          planDetails={accessLabel(payment.succeeded)}
          validUntil={payment.succeeded.validTill ? formatPlanDate(payment.succeeded.validTill) : null}
          onStartLearning={openDashboard}
          onBackHome={openDashboard}
        />
      )}
      {payment.pending && (
        <PaymentPending
          planName={payment.pending.plan.name}
          transactionId={payment.pending.transactionId}
          planDetails={accessLabel(payment.pending.plan)}
          date={payment.pending.initiatedAt}
          refreshing={payment.verifying}
          onRefresh={payment.recheck}
          onBackToDashboard={() => {
            payment.clearPending();
            void openDashboard();
          }}
        />
      )}
      {payment.failed && (
        <PaymentFailed
          planName={payment.failed.plan.name}
          transactionId={payment.failed.transactionId}
          planDetails={accessLabel(payment.failed.plan)}
          date={payment.failed.attemptedAt}
          reason={payment.failed.reason}
          retrying={payment.busy}
          onRetry={payment.retry}
          onExplorePlans={backToPlans}
        />
      )}
      {payment.warning && <WarningDialog message={payment.warning} onClose={payment.dismissWarning} />}
    </>
  );

  if (catalog.isError) {
    return <StatusScreen title="Something Went Wrong" description={userMessage(catalog.error)} />;
  }

  if (step === 'review' && chosen) {
    return (
      <Shell>
        <ReviewStep
          chosen={chosen}
          plans={plans}
          scope={scope}
          coupon={coupon}
          coupons={coupons.data ?? []}
          busy={payment.busy}
          onBack={() => setStep('plan')}
          onSwitchPlan={setPriceId}
          onCouponInput={(input) => setCoupon((state) => ({ ...state, input, error: '' }))}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={() => setCoupon(NO_COUPON)}
          onPay={() => payment.pay(chosen)}
        />
        {overlays}
      </Shell>
    );
  }

  return (
    <Shell>
      <BackButton onClick={() => router.back()} />
      <div className="mt-5 grid grid-cols-1 gap-7 md:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-10">
        <div>
          <h1 className="text-plan-ink max-w-[420px] text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[40px]">
            What are you preparing for?
          </h1>
          <div className="mt-[22px] md:mt-[26px]">
            <Eyebrow>Choose your exam</Eyebrow>
            <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {EXAM_CARDS.map((card) => (
                <ExamCard
                  key={card.key}
                  icon={card.icon}
                  label={card.label}
                  description={card.description}
                  active={examKey === card.key}
                  disabled={!exams.some((entry) => entry.examKey === card.key && isPlanCategory(entry.category))}
                  onClick={() => {
                    setExamKey(card.key);
                    setClassTitle(null);
                    setVariantId(null);
                    setAddBoards(false);
                    resetPlan();
                  }}
                />
              ))}
            </div>
          </div>

          {byYear ? (
            <div className="mt-[22px] md:mt-[26px]">
              <Eyebrow>Target year</Eyebrow>
              <div className="border-plan-line mt-2.5 grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-3">
                {years.map((option) => (
                  <OptionCard
                    key={option.variant_id}
                    icon={<CalendarDays size={15} />}
                    title={`NEET ${option.target_year}`}
                    subtitle={variantValidityLabel(option)}
                    active={variant?.variant_id === option.variant_id}
                    onClick={() => {
                      setVariantId(option.variant_id);
                      resetPlan();
                    }}
                  />
                ))}
              </div>
              {variant?.has_combo && (
                <>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-plan-ink m-0 text-[13px] font-semibold">Boards preparation added</p>
                    <div className="flex items-center gap-2.5">
                      {addBoards && (
                        <span className="text-plan-save flex items-center gap-1 text-[12px] font-semibold">
                          <Check aria-hidden size={13} strokeWidth={3} /> CBSE included
                        </span>
                      )}
                      <Switch
                        checked={addBoards}
                        label="Add CBSE boards"
                        onChange={() => {
                          setAddBoards((value) => !value);
                          resetPlan();
                        }}
                      />
                    </div>
                  </div>
                  {addBoards && (
                    <div className="border-plan-warm-line bg-plan-warm mt-3.5 rounded-[14px] border p-3.5">
                      <p className="text-plan-violet m-0 text-[13px] font-bold">Your plan includes</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {['NEET', 'CBSE · Class 11', 'CBSE · Class 12'].map((chip) => (
                          <span key={chip} className="border-plan-warm-line bg-surface text-plan-warm-text rounded-full border px-3 py-[5px] text-[11px] font-semibold">
                            {chip}
                          </span>
                        ))}
                      </div>
                      <p className="text-plan-warm-text m-0 mt-2.5 text-[11px] leading-4">
                        Both classes are included by default. You&apos;ll land on the NEET dashboard and can switch to either class anytime.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="mt-[22px] md:mt-[26px]">
                <Eyebrow>Choose your class</Eyebrow>
                <div className="border-plan-line mt-2.5 grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3">
                  {classTitles.map((title) => (
                    <OptionCard
                      key={title}
                      icon={<BookOpen size={15} />}
                      title={titleCase(title)}
                      active={activeClass === title}
                      onClick={() => {
                        setClassTitle(title);
                        setVariantId(null);
                        resetPlan();
                      }}
                    />
                  ))}
                </div>
              </div>
              {streams.length > 0 && (
                <div className="mt-[18px]">
                  <Eyebrow>Stream · {titleCase(activeClass ?? '')}</Eyebrow>
                  <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {streams.map((option) => (
                      <OptionCard
                        key={option.variant_id}
                        icon={<Target size={15} />}
                        title={option.stream_name ?? 'Stream'}
                        active={variant?.variant_id === option.variant_id}
                        onClick={() => {
                          setVariantId(option.variant_id);
                          resetPlan();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-plan-line bg-surface h-fit rounded-[18px] border p-3 shadow-[0_24px_60px_-44px_rgba(37,28,81,0.75)] md:p-3.5 lg:sticky lg:top-6">
          <p className="text-plan-deep px-1 pt-1 pb-2.5 text-[13px] font-semibold">Your plans</p>
          {catalog.isPending ? (
            <PlanSkeleton />
          ) : !variant ? (
            <EmptyPlans
              hint={
                byYear
                  ? 'Select your target year to explore the best plan for your preparation.'
                  : 'Select your exam to explore the best plan for your preparation.'
              }
            />
          ) : plans.length === 0 ? (
            <p className="border-plan-line text-plan-muted rounded-[14px] border px-5 py-6 text-center text-[13px]">
              {addBoards
                ? 'No combo plans for this year yet. Turn off boards preparation to see NEET-only plans.'
                : 'No plans are live for this selection yet.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.priceId}
                  plan={plan}
                  active={chosen?.priceId === plan.priceId}
                  onSelect={() => setPriceId(plan.priceId)}
                  onContinue={() => goToReview(plan.priceId)}
                />
              ))}
            </div>
          )}
          <p className="text-plan-muted mt-1.5 text-[12px]">
            * Savings are calculated by comparing the cost of purchasing monthly plans for the entire plan duration with the cost
            of a one-time purchase.
          </p>
        </div>
      </div>

      {plans.length > 0 && (
        <ComparePlans plans={plans} sections={sections} expanded={allLimits} onToggle={() => setAllLimits((value) => !value)} />
      )}

      {chosen && (
        <MobileActionBar
          label={chosen.name}
          amount={chosen.isFree ? 0 : withGst(chosen.price)}
          strikeAmount={chosen.isFree ? null : chosen.mrp}
          cta="Continue"
          onClick={() => goToReview(chosen.priceId)}
        />
      )}
      {overlays}
    </Shell>
  );
}
