'use client';

import { cx } from '@prepzy/design-system';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  capClause,
  inr,
  rateFor,
  rewardFor,
  shareLabel,
  shareOf,
  toggleNote,
  topperGainNote,
  type EarnRate,
  type PlanOption,
  type Reward,
  type Tier,
} from '../api';
import { PlanToggle, SectionHeading } from './kit';

const MAX_JOINS = 50;
const FIELD_LABEL = 'text-[12.5px] leading-[1.5] whitespace-nowrap text-neutral-600 lg:font-medium lg:text-neutral-550';

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (next: number) => void }) {
  const button =
    'text-brand hover:bg-brand-50 flex size-[42px] items-center justify-center text-[16px] font-medium disabled:cursor-not-allowed disabled:opacity-40 lg:h-[46px] lg:w-11 lg:text-[18px]';
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[6px] lg:flex-none lg:gap-2">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="border-neutral-150 bg-surface flex w-fit items-center overflow-hidden rounded-[10px] border lg:rounded-md">
        <button type="button" aria-label={`${label}: fewer`} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
          −
        </button>
        <span aria-live="polite" className="bg-brand-50 text-ink flex h-[42px] w-[52px] items-center justify-center text-[16px] font-semibold lg:h-[46px] lg:w-14 lg:bg-neutral-50 lg:text-[17px] lg:font-bold">
          {value}
        </span>
        <button type="button" aria-label={`${label}: more`} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
          +
        </button>
      </div>
    </div>
  );
}

function PlanSelect({ options, value, onChange }: { options: PlanOption[]; value: number | null; onChange: (priceId: number | null) => void }) {
  const selected = options.find((option) => option.priceId === value) ?? null;
  const groups = useMemo(() => {
    const map = new Map<string, PlanOption[]>();
    for (const option of options) map.set(option.group, [...(map.get(option.group) ?? []), option]);
    return [...map.entries()];
  }, [options]);
  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-[6px] lg:flex-1 lg:gap-2">
      <span className={FIELD_LABEL}>The plan they buy</span>
      <div className="border-neutral-150 bg-surface focus-within:border-brand relative flex w-full items-center gap-2 rounded-[10px] border px-[14px] py-3 lg:gap-[10px] lg:rounded-md lg:px-4">
        <span className={cx('min-w-0 flex-1 truncate text-[13px] leading-[1.5] lg:text-[14px]', selected ? 'text-ink font-semibold' : 'text-neutral-350')}>
          {selected?.label ?? 'Choose the plan they buy'}
        </span>
        {selected && <span className="shrink-0 text-[12px] whitespace-nowrap text-neutral-600 lg:text-[13px]">{inr(selected.price)}</span>}
        <ChevronDown aria-hidden className="text-ink size-4 shrink-0" />
        <select
          aria-label="The plan they buy"
          value={value ?? ''}
          onChange={(event) => onChange(Number(event.target.value) || null)}
          disabled={!options.length}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-wait"
        >
          <option value="" disabled>
            {options.length ? 'Choose the plan they buy' : 'Loading plans…'}
          </option>
          {groups.map(([group, plans]) => (
            <optgroup key={group} label={group}>
              {plans.map((plan) => (
                <option key={plan.priceId} value={plan.priceId}>
                  {plan.label} · {inr(plan.price)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

function shareDetail(reward: Reward, price: number, share: number): string {
  if (reward.flat !== null) return '(flat)';
  const raw = Math.round((price * reward.percent) / 100);
  if (raw < share) return '(the minimum share)';
  if (raw > share) return '(the maximum share)';
  return `(${shareLabel(reward)} of ${inr(price)})`;
}

function Row({ label, detail, amount, strong }: { label: string; detail?: string; amount: string; strong?: boolean }) {
  return (
    <div className="flex w-full items-center gap-[6px] lg:gap-2">
      <span className={cx('text-ink text-[12.5px] leading-[1.5] whitespace-nowrap lg:text-[13px]', strong ? 'font-semibold' : 'font-medium')}>{label}</span>
      {detail && <span className="text-neutral-550 min-w-0 truncate text-[11.5px] lg:text-[12.5px]">{detail}</span>}
      <span className="min-w-0 flex-1" />
      <span className={cx('text-ink text-[13px] whitespace-nowrap lg:text-[13.5px]', strong ? 'font-bold' : 'font-semibold')}>{amount}</span>
    </div>
  );
}

/** Pure total for the calculator (tested). */
export function estimate(reward: Reward, joins: number, buys: number, plan: PlanOption | null) {
  const share = plan ? shareOf(reward, plan.price) : 0;
  const joinTotal = joins * reward.join;
  const buyTotal = plan ? buys * share : 0;
  return { share, joinTotal, buyTotal, total: joinTotal + buyTotal };
}

export function EarningsCalculator({
  ownTier,
  rates,
  options,
  examId,
  hasFriends,
}: {
  ownTier: Tier;
  rates: EarnRate[];
  options: PlanOption[];
  examId: number;
  hasFriends: boolean;
}) {
  const [view, setView] = useState<Tier>(ownTier);
  const [joins, setJoins] = useState(1);
  const [buys, setBuys] = useState(0);
  const [priceId, setPriceId] = useState<number | null>(null);
  const plan = options.find((option) => option.priceId === priceId) ?? null;
  const rate = rateFor(rates, plan?.examId ?? examId);
  const reward = rewardFor(rate, view);
  const note = toggleNote(view, ownTier, topperGainNote(rewardFor(rate, 'free'), rewardFor(rate, 'paid')));
  const caps = capClause(reward);
  const { share, joinTotal, buyTotal, total } = estimate(reward, joins, buys, plan);
  const pickHint = `You get ${inr(reward.join)} as soon as they join. When they buy a plan, you also get ${shareLabel(reward)} of what they pay.`;
  const rows = plan && (
    <>
      <Row label="When they join" detail={`${joins} × ${inr(reward.join)}`} amount={inr(joinTotal)} />
      <Row label="When they buy" detail={`${buys} × ${inr(share)} ${shareDetail(reward, plan.price, share)}`} amount={inr(buyTotal)} />
    </>
  );
  const topper = view === 'paid';

  return (
    <section className="flex w-full flex-col gap-[14px] lg:gap-6">
      <SectionHeading
        eyebrow="Earnings calculator"
        title={hasFriends ? 'See what more referrals could bring you' : 'See what you could earn'}
        sub={
          hasFriends
            ? 'Everyone you invite next earns you the same way. Pick how many might join, how many might buy, and which plan. Switch to Topper to compare.'
            : 'Pick how many people join, how many of them buy, and which plan.'
        }
        mobileSub={
          hasFriends
            ? 'Your next friends earn the same way. Switch to Topper to compare.'
            : 'Pick how many friends join, how many buy, and which plan. Switch to Topper to compare.'
        }
      />
      <div className="border-neutral-150 bg-surface flex w-full flex-col gap-[14px] rounded-lg border p-4 lg:gap-[18px] lg:rounded-xl lg:border-transparent lg:px-7 lg:py-[26px] lg:shadow-[0px_4px_10px_0px_rgba(0,0,0,0.04),0px_1px_3px_0px_rgba(0,0,0,0.05)]">
        <PlanToggle value={view} onChange={setView} note={note.text} noteTone={note.tone} />
        <div className="grid w-full grid-cols-2 items-start gap-3 lg:flex lg:gap-4">
          <Stepper
            label="People who join"
            value={joins}
            min={1}
            max={MAX_JOINS}
            onChange={(next) => {
              setJoins(next);
              setBuys((current) => Math.min(current, next));
            }}
          />
          <Stepper label="People who buy a plan" value={buys} min={0} max={joins} onChange={setBuys} />
          <PlanSelect options={options} value={priceId} onChange={setPriceId} />
        </div>
        <div className={cx('hidden w-full gap-7 rounded-lg px-[22px] py-5 lg:flex', topper ? 'bg-accent-50' : 'bg-neutral-50')}>
          <div className="flex w-[200px] shrink-0 flex-col gap-[2px]">
            <span className="text-neutral-550 text-[12.5px] font-medium">You could get</span>
            <span className="text-ink text-[40px] font-bold whitespace-nowrap" data-testid="estimate-total">
              {inr(total)}
            </span>
            <span className="text-neutral-550 text-[12.5px] font-medium">in Prepzy credits</span>
          </div>
          <span className="bg-neutral-150 w-px shrink-0 self-stretch" />
          {plan ? (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[10px]">
              {rows}
              <span className="bg-neutral-150 h-px w-full" />
              <Row label="Total" amount={inr(total)} strong />
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[6px]">
              <p className="text-ink text-[16px] leading-[1.5] font-semibold">Pick a plan to see the rest</p>
              <p className="text-[14px] leading-[1.5] text-neutral-600">{pickHint}</p>
            </div>
          )}
        </div>
        <div className={cx('flex w-full flex-col gap-[10px] rounded-md p-[14px] lg:hidden', topper ? 'bg-accent-50' : 'bg-neutral-50')}>
          <div className="flex items-baseline gap-2">
            <span className="text-ink text-[32px] leading-[1.2] font-bold whitespace-nowrap">{inr(total)}</span>
            <span className="text-[12px] leading-[1.5] text-neutral-600">you could get, in credits</span>
          </div>
          <span className="bg-neutral-150 h-px w-full" />
          {plan ? (
            rows
          ) : (
            <>
              <p className="text-ink text-[13.5px] leading-[1.5] font-semibold">Pick a plan to see the rest</p>
              <p className="text-[12.5px] leading-[1.5] text-neutral-600">{pickHint}</p>
            </>
          )}
        </div>
        {caps && <p className="text-neutral-550 text-[11.5px] leading-[1.5] lg:text-[12px]">ⓘ&nbsp; Per friend, your share of their plan is {caps}.</p>}
      </div>
    </section>
  );
}
