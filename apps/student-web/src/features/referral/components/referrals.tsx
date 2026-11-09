'use client';

import { cx } from '@prepzy/design-system';
import { useMemo, useState, type ReactNode } from 'react';
import { describeEntry, friendCredit, inr, maskPhone, shortDate, type Friend, type StatementRow } from '../api';
import { Icon, SectionHeading } from './kit';

const VISIBLE = 6;

function Stat({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <div className={cx('flex min-w-0 flex-1 flex-col gap-[2px] lg:flex-none', divided ? 'border-neutral-150 border-l pl-[14px] lg:pl-5' : 'lg:pr-5')}>
      <span className="text-[11.5px] leading-[1.5] font-medium whitespace-nowrap text-neutral-600 lg:text-[12.5px]">{label}</span>
      <span className="text-ink text-[20px] leading-[1.2] font-bold whitespace-nowrap lg:text-[22px] lg:leading-[1.25]">{value}</span>
    </div>
  );
}

function EmptyAvatars() {
  return (
    <div aria-hidden className="relative hidden h-14 w-[120px] shrink-0 lg:block">
      {[0, 34].map((left) => (
        <Icon key={left} name="avatar-empty.png" width={52} height={52} className="absolute top-[2px]" />
      ))}
      <span className="bg-brand text-on-brand absolute top-[2px] left-[68px] flex size-[52px] items-center justify-center rounded-full border-2 border-dashed border-brand-300 text-[26px] leading-none font-medium">
        +
      </span>
    </div>
  );
}

export function ReferralsEmpty({ balance, friendCount, onInvite }: { balance: number; friendCount: number; onInvite: () => void }) {
  return (
    <section className="flex w-full flex-col gap-[14px] lg:gap-5">
      <SectionHeading eyebrow="Your referrals" title="No one has joined yet" />
      <div className="border-brand-300 bg-brand-50 flex w-full flex-col gap-3 rounded-lg border-[1.5px] border-dashed px-4 py-[18px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-7 lg:rounded-xl lg:p-7">
        <EmptyAvatars />
        <div className="flex min-w-0 flex-col gap-3 lg:min-w-[260px] lg:flex-1 lg:gap-[6px]">
          <p className="text-ink text-[15px] leading-[1.5] font-semibold lg:text-[17px]">Send your first invite to get started</p>
          <p className="hidden text-[14px] leading-[1.5] text-neutral-600 lg:block">
            When someone signs up with your link, they show up here with the credits they earned you. You will see who joined and who
            bought a plan.
          </p>
          <p className="text-[12.5px] leading-[1.5] text-neutral-600 lg:hidden">
            When a friend signs up with your link, they show up here with the credits you got for them.
          </p>
        </div>
        <div className="border-neutral-150 bg-surface flex w-full items-start rounded-md border px-[14px] py-3 lg:w-auto lg:items-center lg:rounded-[14px] lg:px-5 lg:py-[14px]">
          <Stat label="Your credits" value={inr(balance)} />
          <Stat label="Referrals joined" value={String(friendCount)} divided />
        </div>
        <button
          type="button"
          onClick={onInvite}
          className="bg-brand text-on-brand hover:bg-brand-hover w-full rounded-[11px] py-3 text-[13.5px] leading-[1.5] font-semibold lg:w-auto lg:rounded-md lg:px-5 lg:py-[13px] lg:text-[14px]"
        >
          Send your first invite
        </button>
      </div>
    </section>
  );
}

const STATUS = {
  paid: { long: 'Bought a plan', short: 'Bought a plan', dot: 'bg-ink', strong: true },
  joined: { long: 'Joined, not bought yet', short: 'Joined', dot: 'bg-neutral-350', strong: false },
  blocked: { long: 'Under review', short: 'Under review', dot: 'bg-neutral-350', strong: false },
} as const;

function FriendAvatar({ name, size }: { name: string | null; size: 34 | 36 }) {
  if (!name) return <Icon name={size === 36 ? 'avatar-unknown.svg' : 'avatar-unknown-sm.svg'} width={size} height={size} />;
  return (
    <span
      className="bg-brand-75 text-brand flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size === 36 ? 14 : 13 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ShowMore({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  if (total <= VISIBLE) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="border-neutral-150 bg-surface text-brand hover:bg-brand-50 w-full border-t py-3 text-[13px] font-semibold"
    >
      {open ? 'Show fewer' : `Show all ${total}`}
    </button>
  );
}

const COLUMNS = 'grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.2fr)_96px] items-center gap-x-4';

export function ReferralsList({ friends, balance, onSend, onUse }: { friends: Friend[]; balance: number; onSend: () => void; onUse: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const bought = friends.filter((friend) => friend.status === 'paid').length;
  const rows = (showAll ? friends : friends.slice(0, VISIBLE)).map((friend) => ({
    friend,
    phone: maskPhone(friend.phone),
    status: STATUS[friend.status],
    credit: inr(friendCredit(friend)),
  }));

  const actions: ReactNode = (
    <>
      <button
        type="button"
        onClick={onSend}
        disabled={balance <= 0}
        className="border-neutral-150 bg-surface text-brand hover:bg-brand-50 min-w-0 flex-1 rounded-[11px] border px-4 py-3 text-[13px] leading-[1.55] font-semibold disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none lg:px-[18px] lg:py-[11px] lg:text-[13.5px]"
      >
        Send credits
      </button>
      <button
        type="button"
        onClick={onUse}
        className="bg-brand text-on-brand hover:bg-brand-hover min-w-0 flex-1 rounded-[11px] px-4 py-3 text-[13px] leading-[1.55] font-semibold lg:flex-none lg:px-[18px] lg:py-[11px] lg:text-[13.5px]"
      >
        Use credits
      </button>
    </>
  );
  const more = <ShowMore total={friends.length} open={showAll} onToggle={() => setShowAll((v) => !v)} />;
  const metric = 'flex flex-col gap-1 px-9';

  return (
    <section className="flex w-full flex-col gap-4 lg:gap-7">
      <SectionHeading eyebrow="Your referrals" title="Your credits and referrals" />
      <div className="bg-brand-50 hidden w-full flex-wrap items-center gap-y-4 rounded-lg px-7 py-6 lg:flex">
        <div className="flex flex-col gap-1 pr-9">
          <span className="text-[13.5px] font-medium text-neutral-600">Your credits</span>
          <span className="text-brand text-[32px] font-semibold">{inr(balance)}</span>
        </div>
        <span className="bg-neutral-150 h-14 w-px" />
        <div className={metric}>
          <span className="text-[13.5px] font-medium text-neutral-600">Referrals joined</span>
          <span className="text-ink text-[28px] font-semibold">{friends.length}</span>
        </div>
        <span className="bg-neutral-150 h-14 w-px" />
        <div className={metric}>
          <span className="text-[13.5px] font-medium text-neutral-600">Bought a plan</span>
          <span className="text-ink text-[28px] font-semibold">{bought}</span>
        </div>
        <span className="min-w-0 flex-1" />
        <div className="flex gap-[10px]">{actions}</div>
      </div>
      <div className="border-neutral-150 hidden w-full overflow-hidden rounded-lg border lg:block">
        <div className={cx(COLUMNS, 'border-neutral-150 border-b px-7 py-[14px] text-[13.5px] font-medium text-neutral-600')}>
          <span>Name</span>
          <span>Exam</span>
          <span>Status</span>
          <span className="text-right">You got</span>
        </div>
        {rows.map(({ friend, phone, status, credit }, index) => (
          <div key={friend.id} className={cx(COLUMNS, 'px-7 py-4', index < rows.length - 1 && 'border-neutral-150 border-b')}>
            <div className="flex min-w-0 items-center gap-3">
              <FriendAvatar name={friend.name} size={36} />
              <div className="flex min-w-0 flex-col">
                <span className="text-ink truncate text-[14px] font-semibold">{friend.name ?? phone ?? 'A friend'}</span>
                <span className={cx('truncate text-[13.5px]', friend.name ? 'text-neutral-600' : 'text-neutral-550')}>
                  {friend.name ? (phone ?? '') : 'No name added'}
                </span>
              </div>
            </div>
            <span className="text-ink truncate text-[13.5px]">{friend.examName ?? '—'}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cx('size-[7px] shrink-0 rounded-full', status.dot)} />
              <span className={cx('truncate text-[13.5px]', status.strong ? 'text-ink' : 'text-neutral-600')}>{status.long}</span>
            </span>
            <span className="text-ink text-right text-[15px] font-semibold whitespace-nowrap">{credit}</span>
          </div>
        ))}
        {more}
      </div>
      <p className="hidden text-[13.5px] leading-[1.55] text-neutral-600 lg:block">
        People show up here once they sign up with your link. Names appear only if they have added one, and phone numbers are partly
        hidden. Anyone you invite who has not signed up yet does not appear.
      </p>

      <div className="border-neutral-150 flex w-full flex-col gap-4 rounded-[14px] border p-[18px] lg:hidden">
        <div className="flex w-full items-start">
          {[
            { label: 'Credits', value: inr(balance) },
            { label: 'Joined', value: String(friends.length) },
            { label: 'Bought', value: String(bought) },
          ].map((m, index) => (
            <div key={m.label} className={cx('flex min-w-0 flex-1 flex-col gap-[2px]', index > 0 && 'border-neutral-150 border-l pl-[14px]')}>
              <span className="text-[12.5px] leading-[1.55] font-medium text-neutral-600">{m.label}</span>
              <span className="text-ink text-[22px] leading-[1.25] font-semibold whitespace-nowrap">{m.value}</span>
            </div>
          ))}
        </div>
        <div className="flex w-full gap-2">{actions}</div>
      </div>
      <div className="border-neutral-150 w-full overflow-hidden rounded-[14px] border lg:hidden">
        {rows.map(({ friend, phone, status, credit }, index) => (
          <div key={friend.id} className={cx('flex items-center gap-3 px-4 py-[14px]', index < rows.length - 1 && 'border-neutral-150 border-b')}>
            <FriendAvatar name={friend.name} size={34} />
            <div className="flex min-w-0 flex-1 flex-col leading-[1.55]">
              <span className="text-ink truncate text-[13.5px] font-semibold">{friend.name ?? phone ?? 'A friend'}</span>
              <span className={cx('truncate text-[12.5px]', friend.name ? 'text-neutral-600' : 'text-neutral-550')}>
                {friend.name ? (phone ?? '') : 'No name added'}
              </span>
              <span className="flex min-w-0 items-center gap-[6px]">
                <span className={cx('size-[6px] shrink-0 rounded-full', status.dot)} />
                <span className="truncate text-[12.5px] text-neutral-600">
                  {friend.examName ? `${friend.examName} · ` : ''}
                  {status.short}
                </span>
              </span>
            </div>
            <span className="text-ink text-[14px] leading-[1.55] font-semibold whitespace-nowrap">{credit}</span>
          </div>
        ))}
        {more}
      </div>
      <p className="text-[12.5px] leading-[1.55] text-neutral-600 lg:hidden">
        Friends show up once they sign up with your link. Names appear only if they added one.
      </p>
    </section>
  );
}

const STATEMENT_COLUMNS = 'grid grid-cols-[160px_minmax(0,1fr)_120px_130px] items-center';
const signed = (amount: number) => `${amount < 0 ? '−' : '+'}${inr(Math.abs(amount))}`;

export function CreditStatement({ statement, friends }: { statement: StatementRow[]; friends: Friend[] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => {
    const byReferral = new Map(friends.map((friend) => [friend.id, friend]));
    return statement
      .filter((row) => row.amount !== 0) // zero-amount rows are payout bookkeeping
      .map((row) => ({
        id: row.id,
        date: shortDate(row.createdAt),
        text: describeEntry(row, byReferral),
        amount: signed(row.amount),
        credit: row.amount > 0,
        balance: inr(row.balanceAfter),
      }));
  }, [statement, friends]);

  if (rows.length === 0) return null;
  const shown = showAll ? rows : rows.slice(0, VISIBLE);
  const more = <ShowMore total={rows.length} open={showAll} onToggle={() => setShowAll((v) => !v)} />;

  return (
    <section className="flex w-full flex-col gap-4 lg:gap-7">
      <SectionHeading eyebrow="Credit statement" title="Every credit, and your balance" />
      <div className="border-neutral-150 hidden w-full overflow-hidden rounded-lg border lg:block">
        <div className={cx(STATEMENT_COLUMNS, 'border-neutral-150 border-b px-7 py-[14px] text-[13.5px] font-medium text-neutral-600')}>
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Balance</span>
        </div>
        {shown.map((row, index) => (
          <div key={row.id} className={cx(STATEMENT_COLUMNS, 'px-7 py-4 font-medium', index < shown.length - 1 && 'border-neutral-150 border-b')}>
            <span className="text-[13.5px] whitespace-nowrap text-neutral-600">{row.date}</span>
            <span className="text-ink truncate pr-4 text-[14px]" title={row.text}>
              {row.text}
            </span>
            <span className={cx('text-right text-[15px] font-semibold whitespace-nowrap', row.credit ? 'text-brand' : 'text-danger')}>{row.amount}</span>
            <span className="text-neutral-550 text-right text-[13.5px] whitespace-nowrap">{row.balance}</span>
          </div>
        ))}
        {more}
      </div>
      <div className="border-neutral-150 w-full overflow-hidden rounded-[14px] border lg:hidden">
        {shown.map((row, index) => (
          <div key={row.id} className={cx('flex items-start gap-3 px-4 py-[14px] leading-[1.55]', index < shown.length - 1 && 'border-neutral-150 border-b')}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-ink text-[13.5px] font-medium">{row.text}</span>
              <span className="text-[12.5px] text-neutral-600">{row.date}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className={cx('text-[14px] font-semibold whitespace-nowrap', row.credit ? 'text-brand' : 'text-danger')}>{row.amount}</span>
              <span className="text-neutral-550 text-[12px] whitespace-nowrap">Balance {row.balance}</span>
            </div>
          </div>
        ))}
        {more}
      </div>
    </section>
  );
}
