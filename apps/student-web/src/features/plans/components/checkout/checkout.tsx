'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, Check, GraduationCap, Target } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { rememberedExam, rememberExam, useCurrentUser } from '@/features/auth';
import { getExam, type ExamCategory, type ExamRef } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { StatusScreen } from '@/shared/layout/status-screens';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { billingMessage, isPlanCategory } from '../../api';
import {
  accessLabel,
  bundledTitles,
  bundleOptionTitles,
  buildSections,
  groupKeyOf,
  sortedClassTitles,
  titleCase,
  toPlans,
  variantLabel,
  variantValidityLabel,
  withGst,
  yearVariants,
  type ApiVariant,
  type CatalogExam,
} from '../../catalog';
import { examParamOf, quoteQuery, useCatalogs, useCheckoutExam, useCoupons, useFeatureLimits, useQuote, type PlanExam } from '../../hooks';
import { formatPlanDate } from '../../money';
import { usePayment } from '../../use-payment';
import { WarningDialog } from '../modal';
import { ComparePlans } from './compare-plans';
import { PaymentFailed, PaymentPending, PaymentSuccess } from './outcome-overlays';
import { BackButton, EmptyPlans, ExamCard, Eyebrow, MobileActionBar, OptionCard, PlanCard, PlanSkeleton, Switch } from './primitives';
import { ReviewStep, type CouponState } from './review-step';

/** Card text per category, unless the API names one. Never per exam: a new exam's card comes from GET /api/v4/exams. */
const CATEGORY_CARD: Partial<Record<ExamCategory, { description: string; icon: ReactNode }>> = {
  board: { description: 'Prepare for your board exams', icon: <BookOpen size={18} /> },
  competitive: { description: 'Prepare for your entrance exam', icon: <GraduationCap size={18} /> },
};

type AnyExamRef = { examId: number; category: ExamCategory | null };
const sameExam = (a: AnyExamRef, b: AnyExamRef) => a.examId === b.examId && a.category === b.category;

const NO_COUPON: CouponState = { input: '', applied: null, error: '', checking: false };

/** Fills the space under the app header (the /purchase layout). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface text-plan-ink flex-1">
      <div className="mx-auto w-full max-w-[1440px] px-5 pt-6 pb-[120px] md:px-8 md:pt-8 lg:pt-10 lg:pb-[72px]">{children}</div>
    </div>
  );
}

/**
 * /purchase — the common checkout of every exam: choose exam, class or target year and a plan, then review and pay.
 * The exam is the page's (?exam=, else the remembered exam, else the first purchasable one: useCheckoutExam);
 * switching exam replaces ?exam= in the URL, so the header and a reload follow it.
 */
export function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const selection = useCheckoutExam();
  const catalog = useCatalogs(selection.exam);

  const examParam = selection.examParam;
  /**
   * The exam the student just picked, until the URL names it (router.replace is async). It is tied to the ?exam= it
   * was picked on, so any later change of the URL (a link to another exam, back / forward) wins over it.
   */
  const [picked, setPicked] = useState<{ exam: ExamRef; on: string | null } | null>(null);
  const [classTitle, setClassTitle] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addBundle, setAddBundle] = useState(false);
  const [priceId, setPriceId] = useState<number | null>(null);
  const [step, setStep] = useState<'plan' | 'review'>('plan');
  const [allLimits, setAllLimits] = useState(false);
  const [coupon, setCoupon] = useState<CouponState>(NO_COUPON);

  const exams = useMemo(() => catalog.data ?? [], [catalog.data]);
  const current = picked && picked.on === examParam ? picked.exam : selection.exam;
  const activeExam: CatalogExam | null = current ? (exams.find((entry) => sameExam(entry, current)) ?? null) : null;

  /** Shows another exam and names it in the URL (replace: switching exam isn't a step back can undo). */
  const selectExam = (exam: PlanExam) => {
    setPicked({ exam: { examId: exam.examId, category: exam.category }, on: examParam });
    router.replace(routes.plansPurchase(examParamOf(exam)), { scroll: false });
  };
  const examTitle = activeExam?.title ?? '';
  // Board-style exams pick a class (and stream); competitive-style ones a target year. From the catalog's group_key.
  const byYear = groupKeyOf(activeExam) === 'target_year';
  // The exam whose billing routes price and sell the selection.
  const billingExam = useMemo(
    () => (activeExam && isPlanCategory(activeExam.category) ? { category: activeExam.category, examId: activeExam.examId } : null),
    [activeExam],
  );
  const limits = useFeatureLimits(billingExam);
  const coupons = useCoupons(billingExam);

  // Preselect the class from ?CLASSID= (old links), else the student's own class, once the catalog lands. A link that
  // names its exam looks only there; otherwise a ?CLASSID= may pick another exam that has that class.
  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (preselected || !catalog.data) return;
    setPreselected(true);
    const home = selection.exam;
    if (!home) return;
    const classParam = params.get('CLASSID') ?? params.get('class');
    const streamParam = Number(params.get('stream_id'));
    const targetClass = classParam ? Number(classParam) : user.data?.classId;
    if (!targetClass) return;
    const homeFirst = [...catalog.data].sort((a, b) => Number(sameExam(b, home)) - Number(sameExam(a, home)));
    const ordered = classParam && !examParam ? homeFirst : homeFirst.filter((entry) => sameExam(entry, home));
    for (const entry of ordered) {
      const match = entry.variants.find(
        (variant) => variant.class_id === targetClass && (!streamParam || variant.stream_id === streamParam),
      );
      if (match) {
        const other = !sameExam(entry, home) && catalog.exams.find((exam) => sameExam(exam, entry));
        if (other) selectExam(other);
        setClassTitle(match.class_title);
        setVariantId(groupKeyOf(entry) === 'target_year' && match.target_year != null ? `year-${match.target_year}` : match.variant_id);
        return;
      }
    }
    // selectExam only reads state setters and the URL of this render; the effect runs once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, catalog.data, catalog.exams, examParam, params, user.data?.classId, selection.exam]);

  const classTitles = useMemo(() => sortedClassTitles(activeExam?.variants ?? []), [activeExam]);
  const years = useMemo(() => (byYear ? yearVariants(activeExam?.variants ?? [], examTitle) : []), [byYear, activeExam, examTitle]);
  const activeClass = byYear ? null : (classTitle ?? classTitles[0] ?? null);
  const classVariants = useMemo(
    () => (activeExam?.variants ?? []).filter((variant) => variant.class_title === activeClass),
    [activeExam, activeClass],
  );
  const streams = classVariants.filter((variant) => variant.stream_id !== null);
  const options = byYear ? years : (activeExam?.variants ?? []);
  const variant: ApiVariant | null =
    options.find((option) => option.variant_id === variantId) ?? (byYear ? years[0] : classVariants[0]) ?? null;
  const bundleTitles = useMemo(() => (variant ? bundleOptionTitles(variant) : []), [variant]);
  const label = variant ? variantLabel(variant, examTitle) : '';

  const plans = useMemo(() => {
    if (!variant) return [];
    const source = variant.has_combo ? variant.plans.filter((plan) => plan.is_combo === addBundle) : variant.plans;
    return toPlans(source, {
      exam: examTitle,
      groupKey: variant.group_key ?? (byYear ? 'target_year' : 'class'),
      bundles: bundleTitles,
      targetYear: variant.target_year ?? null,
    });
  }, [variant, addBundle, examTitle, byYear, bundleTitles]);
  const sections = useMemo(() => buildSections(plans, limits.data ?? []), [plans, limits.data]);
  const chosen = plans.find((plan) => plan.priceId === priceId) ?? plans[0] ?? null;
  // The server's bill for the chosen paid plan (with the applied coupon): every amount on screen comes from it.
  const quote = useQuote(billingExam, chosen && !chosen.isFree ? chosen.priceId : null, coupon.applied);

  // What the plan covers: the variant ("Class 11 PCB", "{exam} 2027") plus the bundled exams of a combo.
  const chosenBundles = chosen?.isCombo ? (chosen.bundled.length ? bundledTitles(chosen.bundled) : bundleTitles) : [];
  const addOnLabel = bundleTitles.join(' + ');
  const contextLabel = variant ? [label, ...(addBundle ? (chosenBundles.length ? chosenBundles : bundleTitles) : [])].join(' + ') : '';
  const scope = contextLabel || examTitle;
  // Chips of a combo: the variant itself, then each course the combo unlocks.
  const comboPlan = plans.find((plan) => plan.isCombo && plan.bundled.length > 0) ?? null;
  const chips = comboPlan
    ? [label, ...comboPlan.bundled.map((course) => [course.exam_title, titleCase(course.class_title)].filter(Boolean).join(' · '))]
    : [label, ...bundleTitles];

  const payment = usePayment({
    exam: billingExam,
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
    // Renewal is blocked while a plan is active: the server would refuse it (409 PLAN_ALREADY_ACTIVE).
    if (plans.find((plan) => plan.priceId === priceIdToReview)?.isCurrent) return;
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

  /** A coupon is valid when the server quotes the chosen price with it (POST /quote). */
  const applyCoupon = async (code?: string) => {
    const value = (code ?? coupon.input).trim();
    if (!value || !billingExam || !chosen) return;
    setCoupon((state) => ({ ...state, input: value, checking: true, error: '' }));
    try {
      await queryClient.fetchQuery(quoteQuery(billingExam, chosen.priceId, value));
      setCoupon({ input: value, applied: value, error: '', checking: false });
    } catch (error) {
      setCoupon((state) => ({ ...state, applied: null, checking: false, error: billingMessage(error, "Couldn't check that coupon. Try again.") }));
    }
  };

  // Switching plan re-prices with the applied coupon; a coupon that doesn't fit the new price is taken off.
  const quoteError = quote.error;
  useEffect(() => {
    if (!coupon.applied || !isApiError(quoteError) || quoteError.status !== 400) return;
    setCoupon({ ...NO_COUPON, input: coupon.applied, error: userMessage(quoteError, 'This coupon does not apply to this plan.') });
  }, [coupon.applied, quoteError]);

  /**
   * Fresh subscription state everywhere, then the purchased exam's dashboard. An exam the app has no pages for yet
   * lands on the remembered exam's dashboard, else on Manage Plans (which lists the new plan).
   */
  const openDashboard = async (purchased: ExamRef | null) => {
    const own = purchased ? catalog.exams.find((exam) => sameExam(exam, purchased))?.slug : null;
    const slug = own ?? getExam(rememberedExam())?.slug ?? null;
    if (slug) rememberExam(slug);
    await queryClient.invalidateQueries();
    router.replace(slug ? routes.dashboard(slug) : routes.managePlans());
  };
  const openPurchasedDashboard = () => openDashboard(payment.succeededExam ?? billingExam);

  const overlays = (
    <>
      {payment.succeeded && (
        <PaymentSuccess
          planName={payment.succeeded.name}
          courseAccess={contextLabel || 'Your course'}
          planDetails={accessLabel(payment.succeeded)}
          validUntil={payment.succeeded.validTill ? formatPlanDate(payment.succeeded.validTill) : null}
          onStartLearning={openPurchasedDashboard}
          onBackHome={openPurchasedDashboard}
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
            const exam = payment.pending?.exam ?? billingExam;
            payment.clearPending();
            void openDashboard(exam);
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
          quote={quote.data ?? null}
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
              {catalog.exams.map((entry) => {
                const card = CATEGORY_CARD[entry.category];
                const loaded = exams.find((known) => known.examId === entry.examId);
                return (
                  <ExamCard
                    key={entry.examId}
                    icon={card?.icon ?? <BookOpen size={18} />}
                    label={loaded?.title || entry.name}
                    description={card?.description ?? ''}
                    active={activeExam?.examId === entry.examId}
                    disabled={!loaded}
                    onClick={() => {
                      selectExam(entry);
                      setClassTitle(null);
                      setVariantId(null);
                      setAddBundle(false);
                      resetPlan();
                    }}
                  />
                );
              })}
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
                    title={variantLabel(option, examTitle)}
                    subtitle={variantValidityLabel(option)}
                    active={variant?.variant_id === option.variant_id}
                    onClick={() => {
                      setVariantId(option.variant_id);
                      resetPlan();
                    }}
                  />
                ))}
              </div>
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

          {variant?.has_combo && (
            <>
              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-plan-ink m-0 text-[13px] font-semibold">{addOnLabel ? `Add ${addOnLabel}` : 'Add bundled courses'}</p>
                <div className="flex items-center gap-2.5">
                  {addBundle && (
                    <span className="text-plan-save flex items-center gap-1 text-[12px] font-semibold">
                      <Check aria-hidden size={13} strokeWidth={3} /> {addOnLabel || 'Bundle'} included
                    </span>
                  )}
                  <Switch
                    checked={addBundle}
                    label={addOnLabel ? `Add ${addOnLabel}` : 'Add bundled courses'}
                    onChange={() => {
                      setAddBundle((value) => !value);
                      resetPlan();
                    }}
                  />
                </div>
              </div>
              {addBundle && (
                <div className="border-plan-warm-line bg-plan-warm mt-3.5 rounded-[14px] border p-3.5">
                  <p className="text-plan-violet m-0 text-[13px] font-bold">Your plan includes</p>
                  <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Your plan includes">
                    {chips.filter(Boolean).map((chip) => (
                      <li key={chip} className="border-plan-warm-line bg-surface text-plan-warm-text rounded-full border px-3 py-[5px] text-[11px] font-semibold">
                        {chip}
                      </li>
                    ))}
                  </ul>
                  <p className="text-plan-warm-text m-0 mt-2.5 text-[11px] leading-4">
                    Everything listed is included. You&apos;ll land on the {examTitle || 'exam'} dashboard and can switch courses anytime.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-plan-line bg-surface h-fit rounded-[18px] border p-3 shadow-[0_24px_60px_-44px_rgba(37,28,81,0.75)] md:p-3.5 lg:sticky lg:top-[100px]">
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
              {addBundle
                ? 'No bundle plans for this selection yet. Turn off the add-on to see the other plans.'
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
          amount={chosen.isFree ? 0 : (quote.data?.totalAmount ?? withGst(chosen.price))}
          strikeAmount={chosen.isFree ? null : chosen.mrp}
          cta={chosen.isCurrent ? 'Current plan' : 'Continue'}
          disabled={chosen.isCurrent}
          onClick={() => goToReview(chosen.priceId)}
        />
      )}
      {overlays}
    </Shell>
  );
}
