'use client';

import { Hash, Link2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { partnerRoutes, type FriendStatus, type PartnerFriend, type PartnerStatementRow, type PartnerSummary } from '../api';
import { copyText, describeEntry, formatDate, inr, shareMessage } from '../format';
import { usePartnerFriends, usePartnerProfile, usePartnerStatement, usePartnerSummary, useUnfinishedSignupRedirect } from '../hooks';
import { PartnerLoadError, PartnerLoading, PartnerShell } from './shell';

const card = 'rounded-[16px] border border-partner-border bg-neutral-0';
const eyebrow = 'text-[11px] font-bold tracking-[0.12em] text-brand-700 uppercase';
const th = 'px-6 pb-2 text-[11px] font-bold whitespace-nowrap text-neutral-400 uppercase';
const td = 'px-6 py-4 text-[13px] whitespace-nowrap';

const STATUS_BADGE: Record<FriendStatus, string> = {
  paid: 'bg-partner-ok-soft text-partner-ok',
  blocked: 'bg-partner-red-soft text-partner-red',
  joined: 'bg-partner-tile text-brand-700',
};

function useCopied<T extends string>() {
  const [copied, setCopied] = useState<T | null>(null);
  const copy = async (value: string, which: T) => {
    if (!(await copyText(value))) return;
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };
  return { copied, copy };
}

export function ShareDialog({ summary, onClose }: { summary: PartnerSummary; onClose: () => void }) {
  const { copied, copy } = useCopied<'link' | 'code'>();
  const option =
    'flex items-center gap-4 rounded-lg border border-partner-input-line px-6 py-3.5 text-[14px] font-semibold text-brand-950 transition-all';
  return (
    <div className="bg-night-950/45 fixed inset-0 z-50 flex items-center justify-center p-12 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-share-title"
        className="bg-neutral-0 relative w-full max-w-[420px] overflow-hidden rounded-[24px] shadow-[0_20px_60px_rgba(26,18,64,0.25)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="bg-brand-50 text-partner-label hover:bg-partner-tile hover:text-brand-700 absolute top-4 right-4 grid h-[32px] w-[32px] place-items-center rounded-full transition-colors"
        >
          <X size={17} />
        </button>
        <div className="px-12 pt-12 pb-6">
          <h3 id="partner-share-title" className="text-brand-950 mb-2 text-[18px] leading-[1.2] font-bold">
            Share your link
          </h3>
        </div>
        <div className="flex flex-col gap-2.5 px-12 pb-12">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareMessage(summary.shareLink))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${option} hover:border-success-350 hover:bg-partner-wa-soft no-underline hover:shadow-[0_4px_14px_rgba(37,211,102,0.15)]`}
          >
            <span className="bg-success-350 grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-[0_3px_8px_rgba(37,211,102,0.35)]">
              <Image src="/illustrations/referral/whatsapp.svg" alt="" width={21} height={21} className="brightness-0 invert" />
            </span>
            Share on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => void copy(summary.shareLink, 'link')}
            className={`${option} hover:border-brand-700 hover:bg-brand-50 hover:shadow-[0_4px_14px_rgba(61,52,139,0.12)]`}
          >
            <span className="bg-brand-700 text-neutral-0 grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-[0_3px_8px_rgba(61,52,139,0.3)]">
              <Link2 size={18} />
            </span>
            {copied === 'link' ? 'Link copied!' : 'Copy invite link'}
          </button>
          <button
            type="button"
            onClick={() => void copy(summary.code, 'code')}
            className={`${option} hover:border-accent-400 hover:bg-partner-orange-soft hover:shadow-[0_4px_14px_rgba(255,170,62,0.18)]`}
          >
            <span className="bg-accent-400 text-neutral-0 grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold shadow-[0_3px_8px_rgba(255,170,62,0.35)]">
              <Hash size={18} />
            </span>
            {copied === 'code' ? 'Code copied!' : `Copy code · ${summary.code}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  { n: 1, title: 'Share your link', desc: 'One link works for every exam a friend picks.' },
  { n: 2, title: 'They join, you earn', desc: 'You get a signup credit the moment they sign up.' },
  { n: 3, title: 'They pay, you earn more', desc: 'When they pay, you earn your commission on the plan.' },
];

function EmptyState({ onShare }: { onShare: () => void }) {
  return (
    <>
      <div className="border-partner-border bg-neutral-0 mb-12 rounded-[20px] border p-6 text-center">
        <div className="bg-brand-50 mx-auto grid h-[64px] w-[64px] place-items-center rounded-[20px] text-[28px]" aria-hidden>
          🚀
        </div>
        <h2 className="text-brand-950 mt-6 mb-2 text-[20px] leading-[1.2] font-bold">No referrals yet</h2>
        <p className="text-neutral-650 mx-auto mt-2 mb-4 max-w-[430px] text-[13.5px] leading-[19px]">
          Share your link with students and parents. You earn when they join, and more when they pay.
        </p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onShare}
            className="bg-brand-700 text-neutral-0 hover:bg-partner-hover rounded-md px-12 py-4 text-[14px] font-bold transition-colors"
          >
            Share your link
          </button>
          <span className="bg-brand-50 text-brand-700 rounded-full px-4 py-2 text-[12.5px] font-semibold">Balance {inr(0)}</span>
        </div>
      </div>

      <div className={`${card} p-[14px]`}>
        <div className={eyebrow}>How it works</div>
        <div className="mt-6 flex flex-col gap-6">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.n} className="flex items-start gap-4">
              <span className="bg-brand-700 text-neutral-0 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold">
                {step.n}
              </span>
              <div>
                <div className="text-brand-950 text-[14px] font-bold">{step.title}</div>
                <div className="text-partner-grey text-[12.5px] leading-[17px]">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function FriendsTable({ friends }: { friends: PartnerFriend[] }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`${eyebrow} p-[20px] pb-4`}>Your friends</div>
      {friends.length === 0 ? (
        <div className="text-partner-grey px-[20px] py-6 text-center text-[13px]">No friends yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {['Friend', 'Phone', 'Exam', 'Status', 'Date'].map((label) => (
                  <th key={label} className={`${th} text-left`}>
                    {label}
                  </th>
                ))}
                <th className={`${th} text-right`}>Earned</th>
              </tr>
            </thead>
            <tbody>
              {friends.map((friend) => (
                <tr key={friend.id} className="border-partner-border border-t">
                  <td className={`${td} text-brand-950 font-semibold`}>{friend.name || '—'}</td>
                  <td className={`${td} text-neutral-650`}>{friend.phone || '—'}</td>
                  <td className={`${td} text-neutral-650`}>{friend.examName || '—'}</td>
                  <td className={td}>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap capitalize ${STATUS_BADGE[friend.status]}`}>
                      {friend.status}
                    </span>
                  </td>
                  <td className={`${td} text-neutral-650`}>{formatDate(friend.attributedAt)}</td>
                  <td className={`${td} text-brand-950 text-right font-bold`}>{inr(friend.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatementTable({ rows }: { rows: PartnerStatementRow[] }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`${eyebrow} p-[20px] pb-4`}>Credit statement</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Date</th>
              <th className={`${th} text-left`}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={`${th} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-partner-grey px-[20px] py-6 text-center text-[13px]">
                  Nothing yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-partner-border border-t">
                  <td className={`${td} text-neutral-650`}>{formatDate(row.createdAt)}</td>
                  <td className={`${td} text-brand-950`}>{describeEntry(row)}</td>
                  <td className={`${td} text-right font-bold ${row.amount < 0 ? 'text-partner-error' : 'text-success-500'}`}>
                    {row.amount >= 0 ? '+' : '−'}
                    {inr(Math.abs(row.amount))}
                  </td>
                  <td className={`${td} text-neutral-650 text-right`}>{inr(row.balanceAfter)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stats({ summary }: { summary: PartnerSummary }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
      <div className="from-partner-card-from to-brand-700 text-neutral-0 flex flex-col rounded-[20px] bg-linear-135 p-6">
        <div className="text-[12px] font-bold tracking-[0.08em] uppercase opacity-85">Available to withdraw</div>
        <div className="mt-2 text-[30px] leading-none font-black">{inr(summary.balance)}</div>
        <Link
          href={partnerRoutes.payouts}
          className="bg-accent-400 text-neutral-0 hover:bg-partner-orange-hover mt-1 block w-full rounded-md px-6 py-2.5 text-center text-[13.5px] font-bold no-underline transition-colors"
        >
          Request payout
        </Link>
      </div>
      <div className={`${card} p-6`}>
        <div className="text-partner-grey text-[12px]">Pending (unsettled)</div>
        <div className="text-brand-950 mt-2 text-[26px] leading-none font-extrabold">{inr(summary.pendingUnsettled)}</div>
        <div className="text-partner-grey mt-1.5 text-[12px]">
          {summary.pendingUnsettled > 0 ? 'Awaiting payout approval' : 'No open payout requests'}
        </div>
      </div>
      <div className={`${card} p-6`}>
        <div className="text-partner-grey text-[12px]">Lifetime paid out</div>
        <div className="text-brand-950 mt-2 text-[26px] leading-none font-extrabold">{inr(summary.lifetimePaidOut)}</div>
        <div className="text-success-500 mt-1.5 text-[12px]">
          Across {summary.friendCount} friend{summary.friendCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

function InviteCard({ summary, onShare }: { summary: PartnerSummary; onShare: () => void }) {
  const { copied, copy } = useCopied<'link'>();
  return (
    <div className={`${card} p-[20px]`}>
      <div className={eyebrow}>Your invite</div>
      <div className="border-partner-input-line bg-partner-input mt-4 flex items-center justify-between gap-2 rounded-md border px-6 py-4">
        <span className="text-brand-950 truncate text-[13px]">{summary.shareLink}</span>
        <button
          type="button"
          onClick={() => void copy(summary.shareLink, 'link')}
          className="text-brand-700 hover:bg-brand-50 shrink-0 rounded-md px-4 py-1.5 text-[13px] font-bold transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="bg-brand-50 text-brand-700 rounded-[6px] px-2.5 py-1 text-[11px] font-bold">Code: {summary.code}</span>
        <button
          type="button"
          onClick={onShare}
          className="text-brand-700 hover:bg-brand-50 rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors"
        >
          More share options
        </button>
      </div>
    </div>
  );
}

/** Partner home: balance, invite link, referred friends and the credit statement (or the first-steps state). */
export function PartnerDashboard() {
  const profile = usePartnerProfile();
  const summary = usePartnerSummary();
  const friends = usePartnerFriends();
  const statement = usePartnerStatement();
  const [sharing, setSharing] = useState(false);
  const unfinished = useUnfinishedSignupRedirect(profile.error);

  if (unfinished || profile.isPending || summary.isPending) return <PartnerLoading />;
  if (profile.isError || summary.isError) {
    return (
      <PartnerLoadError
        onRetry={() => {
          void profile.refetch();
          void summary.refetch();
        }}
      />
    );
  }

  const data = summary.data;
  const isActive = data.friendCount > 0 || data.balance > 0 || data.lifetimeEarned > 0;
  const open = () => setSharing(true);

  return (
    <PartnerShell profile={profile.data} active="dashboard">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-brand-950 mb-1 text-[24px] leading-[1.2] font-bold">Welcome, {profile.data.name}</h1>
          <p className="text-partner-grey mb-4 text-[13.5px]">
            {isActive ? "Here's how your referrals are doing." : 'Share your link and start earning.'}
          </p>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={open}
            className="bg-accent-400 text-neutral-0 hover:bg-partner-orange-hover shrink-0 rounded-md px-12 py-4 text-[14px] font-bold whitespace-nowrap transition-colors"
          >
            Share link
          </button>
        )}
      </div>

      {isActive ? (
        <>
          <Stats summary={data} />
          <div className="flex flex-col gap-12">
            <InviteCard summary={data} onShare={open} />
            <FriendsTable friends={friends.data ?? []} />
            <StatementTable rows={statement.data ?? []} />
          </div>
        </>
      ) : (
        <EmptyState onShare={open} />
      )}

      {sharing && <ShareDialog summary={data} onClose={() => setSharing(false)} />}
    </PartnerShell>
  );
}
