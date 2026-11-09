'use client';

import { cx } from '@prepzy/design-system';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowRight, ChevronRight, CreditCard, Gift, User, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCurrentUser, useLogout, type Student } from '@/features/auth';
import { DeleteAccountDialog } from '@/features/profile/ui';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { ExamList, sectionLabel, useOwnedExams } from './exam-selector';
import { usePlanSummary } from './shell-api';

export function initialsOf(student: Pick<Student, 'firstName' | 'lastName'> | undefined): string {
  if (!student) return 'U';
  const first = student.firstName.charAt(0).toUpperCase();
  const last = student.lastName.charAt(0).toUpperCase();
  return first ? first + last : 'U';
}

/** Orange initials circle (or the profile photo) used by every account button. */
export function Avatar({ student, size = 'md' }: { student: Student | undefined; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'size-12 text-lg' : 'size-9 text-sm';
  if (student?.profilePicture) {
    // Profile photos come from several CDNs; a plain img avoids listing each in next.config.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={student.profilePicture} alt="" className={cx(box, 'border-line rounded-full border object-cover')} />;
  }
  return (
    <span className={cx(box, 'bg-accent text-on-brand flex items-center justify-center rounded-full font-semibold')}>
      {initialsOf(student)}
    </span>
  );
}

export function ProfileHeader({ student }: { student: Student | undefined }) {
  return (
    <div className="bg-brand rounded-lg p-3">
      <p className="text-on-brand text-[16px] font-semibold">{student?.fullName ?? 'Student'}</p>
      {student?.phone && <p className="text-on-brand/80 text-[12px]">{student.phone}</p>}
    </div>
  );
}

function MenuCard({
  href,
  icon: Icon,
  title,
  description,
  onNavigate,
  asMenuItem,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  onNavigate?: () => void;
  asMenuItem: boolean;
}) {
  const card = (
    <Link
      href={href}
      onClick={onNavigate}
      className="border-line bg-surface hover:bg-brand-50 data-[highlighted]:bg-brand-50 flex items-center gap-3 rounded-lg border p-3 outline-none"
    >
      <span className="bg-brand/10 text-brand rounded-md p-2.5">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-neutral-950 text-[14px] font-bold">{title}</span>
        <span className="text-foreground-muted text-[10px]">{description}</span>
      </span>
      <ChevronRight aria-hidden className="size-5" />
    </Link>
  );
  return asMenuItem ? <DropdownMenu.Item asChild>{card}</DropdownMenu.Item> : card;
}

/** "Delete Account" opens a confirmation dialog; the menu stays open underneath until it's answered. */
function DeleteAccountButton({ asMenuItem }: { asMenuItem: boolean }) {
  const className =
    'border-line bg-surface hover:bg-danger-soft data-[highlighted]:bg-danger-soft flex w-full items-center justify-center rounded-lg border p-3 text-[14px] font-bold text-neutral-950 outline-none';
  return (
    <DeleteAccountDialog
      trigger={(open) =>
        asMenuItem ? (
          <DropdownMenu.Item
            className={className}
            onSelect={(event) => {
              event.preventDefault();
              open();
            }}
          >
            Delete Account
          </DropdownMenu.Item>
        ) : (
          <button type="button" className={className} onClick={open}>
            Delete Account
          </button>
        )
      }
    />
  );
}

function LogoutButton({ asMenuItem }: { asMenuItem: boolean }) {
  const logout = useLogout();
  const className =
    'border-line bg-surface hover:bg-danger-soft data-[highlighted]:bg-danger-soft text-danger flex w-full items-center justify-center rounded-lg border p-3 text-[14px] font-bold outline-none disabled:opacity-60';
  const label = logout.isPending ? 'Logging out…' : 'Logout';
  return asMenuItem ? (
    <DropdownMenu.Item
      className={className}
      disabled={logout.isPending}
      onSelect={(event) => {
        event.preventDefault();
        logout.mutate();
      }}
    >
      {label}
    </DropdownMenu.Item>
  ) : (
    <button type="button" className={className} disabled={logout.isPending} onClick={() => logout.mutate()}>
      {label}
    </button>
  );
}

/** NEET plan summary ("Active plan" card + upgrade banner for Basic plans). */
function PlanSummaryCard({ exam, onNavigate }: { exam: ExamConfig | null; onNavigate?: () => void }) {
  const summary = usePlanSummary(exam);
  const plan = summary.data;
  if (!exam || !plan) return null;
  return (
    <div>
      <span className={sectionLabel}>Active plan</span>
      <div className="border-line mt-2 flex items-start justify-between gap-2 rounded-lg border p-3">
        <div className="flex flex-col">
          <span className="text-brand text-[15px] font-bold">{plan.planName}</span>
          <span className="text-foreground-muted mt-0.5 text-[12px]">
            {plan.isFreeForever ? 'Free forever' : `Expires ${plan.expiryDate ?? ''} · ${plan.daysLeft ?? 0} days left`}
          </span>
        </div>
        <span className="bg-neutral-950 text-on-brand rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap uppercase">
          {plan.status}
        </span>
      </div>
      {plan.planType === 'basic' && (
        <Link
          href={routes.plans(exam.slug)}
          onClick={onNavigate}
          className="bg-brand mt-3 flex items-center justify-between gap-2 rounded-lg p-3"
        >
          <span className="text-on-brand text-[12px] font-medium">Unlock upto 10x Usage Limits</span>
          <span className="bg-surface text-brand flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold">
            Upgrade <ArrowRight aria-hidden className="size-3.5" />
          </span>
        </Link>
      )}
    </div>
  );
}

/**
 * Body of every account menu (desktop dropdown, NEET mobile panel, board mobile drawer).
 * `top` lets the board drawer put its class switcher card first.
 */
export function AccountMenuBody({
  exam,
  asMenuItems = false,
  showExams = false,
  showReferral = false,
  onNavigate,
  top,
}: {
  exam: ExamConfig | null;
  asMenuItems?: boolean;
  showExams?: boolean;
  showReferral?: boolean;
  onNavigate?: () => void;
  top?: ReactNode;
}) {
  const user = useCurrentUser();
  const owned = useOwnedExams();
  const competitive = exam?.category === 'competitive';
  return (
    <div className="flex flex-col gap-3">
      {top ?? <ProfileHeader student={user.data} />}
      <PlanSummaryCard exam={exam} onNavigate={onNavigate} />
      {showExams && owned.length > 0 && (
        <div>
          <span className={sectionLabel}>Active course</span>
          <div className="mt-2">
            <ExamList owned={owned} current={exam} onSelect={onNavigate} />
          </div>
        </div>
      )}
      {exam && (
        <>
          <MenuCard
            href={routes.profile(exam.slug)}
            icon={User}
            title="My Profile"
            description="View and edit profile"
            onNavigate={onNavigate}
            asMenuItem={asMenuItems}
          />
          {showReferral && (
            <MenuCard
              href={routes.referAndEarn(exam.slug)}
              icon={Gift}
              title="Refer & Earn"
              description="Invite friends, earn credits"
              onNavigate={onNavigate}
              asMenuItem={asMenuItems}
            />
          )}
          <MenuCard
            href={routes.plans(exam.slug)}
            icon={CreditCard}
            title={competitive ? 'My Plans' : 'Manage Plans'}
            description={competitive ? 'View your active plan' : 'Upgrade or change plan'}
            onNavigate={onNavigate}
            asMenuItem={asMenuItems}
          />
        </>
      )}
      <DeleteAccountButton asMenuItem={asMenuItems} />
      <LogoutButton asMenuItem={asMenuItems} />
    </div>
  );
}

/** Desktop: initials avatar that opens the account dropdown. */
export function AccountMenu({ exam }: { exam: ExamConfig | null }) {
  const user = useCurrentUser();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger aria-label="Account menu" className="shrink-0 rounded-full">
        <Avatar student={user.data} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={12}
          className="border-line bg-surface z-50 w-[300px] rounded-md border p-5 shadow-lg"
        >
          <AccountMenuBody exam={exam} asMenuItems />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
