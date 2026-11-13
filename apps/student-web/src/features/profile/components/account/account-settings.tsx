'use client';

import { cx } from '@prepzy/design-system';
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { icon, Icon } from '../kit';

export interface PlanInfo {
  title: string;
  subtitle: string;
  /** Phones show a shorter title (e.g. "Topper Plan & 3+ Plans") with only the end date below. */
  mobileTitle: string;
  mobileSubtitle: string;
}

function Responsive({ mobile, desktop }: { mobile?: string; desktop: string }) {
  if (!mobile || mobile === desktop) return <>{desktop}</>;
  return (
    <>
      <span className="lg:hidden">{mobile}</span>
      <span className="hidden lg:inline">{desktop}</span>
    </>
  );
}

function SettingsRow({
  name,
  title,
  mobileTitle,
  subtitle,
  mobileSubtitle,
  action,
  last,
  onClick,
}: {
  name: string;
  title: string;
  mobileTitle?: string;
  subtitle: string;
  mobileSubtitle?: string;
  action?: ReactNode;
  last?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="bg-brand-75 shrink-0 rounded-[10px] p-[9px]">
        <Icon name={name} size={18} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px] text-left">
        <p className="text-account-ink text-[14px] leading-normal font-semibold">
          <Responsive mobile={mobileTitle} desktop={title} />
        </p>
        <p className="text-neutral-550 text-[12px] leading-normal">
          <Responsive mobile={mobileSubtitle} desktop={subtitle} />
        </p>
      </div>
      {action ?? <Icon name="chevron-right.svg" size={16} />}
    </>
  );
  const className = cx('flex w-full items-center gap-[14px] py-[14px]', !last && 'border-account-line border-b');
  // A row with its own button can't be a button itself.
  return onClick && !action ? (
    <button type="button" onClick={onClick} className={cx(className, 'cursor-pointer')}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border-account-line w-full rounded-[16px] border px-[16px] pt-[20px] pb-[8px] lg:px-[20px]">
      <p className="text-neutral-550 mb-[6px] text-[11px] leading-normal font-semibold tracking-[0.88px]">{title}</p>
      {children}
    </div>
  );
}

const dimmed = 'disabled:cursor-not-allowed disabled:opacity-40';

// Opens the app's store page on the phone (marketing site link, as in the previous app).
const DOWNLOAD_URL = 'https://prepzy.ai/download-app/index.html';
const STORES = [
  {
    label: 'Android',
    subtitle: 'Get it on Google Play',
    name: 'android.svg',
    href: 'https://play.google.com/store/apps/details?id=com.prepzyai.learning',
  },
  {
    label: 'iPhone',
    subtitle: 'Download on the App Store',
    name: 'iphone.svg',
    href: 'https://apps.apple.com/in/app/prepzy/id6755623582',
  },
];

/** "Study offline in the Prepzy app": QR code (desktop) and store links. No desktop app yet. */
export function GetAppModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="bg-account-scrim/40 fixed inset-0 z-[1100] flex items-center justify-center px-[16px] leading-normal"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="get-app-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface shadow-account-modal flex w-full max-w-[520px] flex-col gap-[16px] rounded-[24px] p-[24px]"
      >
        <h2 id="get-app-title" className="text-account-ink text-[20px] leading-normal font-bold">
          Study offline in the Prepzy app
        </h2>
        <p className="text-neutral-550 text-[13px] leading-normal">
          Downloads work in the Prepzy mobile app. Log in with the same number and your plans, progress and medium are
          already there.
        </p>
        <div className="flex items-center gap-[16px]">
          {/* A QR code only helps on a bigger screen */}
          <div className="border-account-line hidden shrink-0 flex-col items-center gap-[8px] rounded-[16px] border p-[12px] sm:flex">
            <Image
              src={icon('get-app-qr.svg')}
              alt={`QR code for ${DOWNLOAD_URL}`}
              width={120}
              height={120}
              unoptimized
            />
            <p className="text-neutral-550 text-[11px] leading-normal font-medium">Scan with your phone</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
            {STORES.map((store) => (
              <a
                key={store.label}
                href={store.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-account-outline hover:border-brand hover:bg-account-card-hover flex items-center gap-[12px] rounded-[14px] border px-[14px] py-[12px] no-underline transition-colors"
              >
                <span className="bg-brand-75 flex shrink-0 rounded-[10px] p-[7px]">
                  <Icon name={store.name} size={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="text-account-ink text-[13px] font-semibold">{store.label}</span>
                  <span className="text-neutral-550 text-[11px]">{store.subtitle}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border-account-outline text-brand hover:bg-account-soft rounded-full border px-[20px] py-[10px] text-[13px] font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Right column of My Account: plan, more (parent, app, notifications, refer, help), log out, delete. */
export function AccountSettings({
  plan,
  offline,
  onManagePlans,
  onOpenParent,
  onOpenHelp,
  onOpenRefer,
  onDeleteAccount,
  onLogout,
  loggingOut,
}: {
  plan: PlanInfo | null;
  offline: boolean;
  onManagePlans: () => void;
  onOpenParent: () => void;
  onOpenHelp: () => void;
  onOpenRefer: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [showGetApp, setShowGetApp] = useState(false);
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-[16px] lg:gap-[20px]">
      {showGetApp && <GetAppModal onClose={() => setShowGetApp(false)} />}

      <SettingsGroup title="PLAN">
        <SettingsRow
          name="plan.svg"
          title={plan?.title ?? 'No active plan'}
          mobileTitle={plan?.mobileTitle}
          subtitle={plan?.subtitle ?? 'Pick a plan to unlock everything'}
          mobileSubtitle={plan?.mobileSubtitle}
          last
          action={
            <button
              type="button"
              onClick={onManagePlans}
              disabled={offline}
              className={cx(
                'bg-brand hover:bg-account-hover text-on-brand shrink-0 rounded-full px-[16px] py-[8px] text-[12px] font-semibold transition-colors',
                dimmed,
              )}
            >
              Manage plans
            </button>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="MORE">
        <SettingsRow
          name="parent.svg"
          title="Parent"
          subtitle="Let a parent follow your progress"
          onClick={onOpenParent}
        />
        {/* Downloads only exist in the mobile app, so this opens the same Get the app sheet */}
        <div className="lg:hidden">
          <SettingsRow
            name="downloads.svg"
            title="Downloads"
            subtitle="What is saved on this device"
            onClick={() => setShowGetApp(true)}
          />
        </div>
        <div className="hidden lg:block">
          <SettingsRow
            name="get-app.svg"
            title="Get the Prepzy app"
            subtitle="Save books and study offline"
            onClick={() => setShowGetApp(true)}
          />
        </div>
        <SettingsRow name="notifications.svg" title="Notifications" subtitle="Reminders and updates" />
        <SettingsRow
          name="refer.svg"
          title="Refer & Earn"
          subtitle="Invite friends, earn credits"
          onClick={onOpenRefer}
        />
        <SettingsRow
          name="help.svg"
          title="Help and support"
          subtitle="Report a problem or ask a question"
          last
          onClick={onOpenHelp}
        />
      </SettingsGroup>

      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="bg-surface border-account-line hover:bg-account-logout-soft flex w-full items-center justify-center gap-[8px] rounded-[16px] border py-[14px] transition-colors disabled:opacity-60 lg:py-[12px]"
      >
        <Icon name="logout.svg" size={16} />
        <span className="text-account-logout text-[14px] font-semibold">
          {loggingOut ? 'Logging out...' : 'Log out'}
        </span>
      </button>

      <button
        type="button"
        onClick={onDeleteAccount}
        disabled={offline}
        className={cx('text-neutral-550 w-full py-[4px] text-[13px] font-medium underline', dimmed)}
      >
        Delete account
      </button>
    </div>
  );
}
