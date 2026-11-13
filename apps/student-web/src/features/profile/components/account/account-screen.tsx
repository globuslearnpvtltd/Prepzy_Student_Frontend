'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePlans, useActivePlan, useLogout } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import type { Profile } from '../../api';
import { isDesktop, useOffline, usePlanSummary, useProfile } from '../../hooks';
import { DeleteAccountModal } from '../delete/delete-dialog';
import { DeleteResult } from '../delete/delete-parts';
import type { DeleteResultInfo } from '../delete/use-delete-account';
import { ErrorState, formatDay, Icon, OfflineBanner, pageContainer } from '../kit';
import { AccountSettings, type PlanInfo } from './account-settings';
import { AccountDesktopHeadingSkeleton, AccountSkeleton } from './account-states';
import { EditColumn } from './edit-column';
import { LogoutConfirm } from './logout-confirm';
import { MobileProfileCard, ProfileCard, type Chip } from './profile-card';

// The last loaded account, so the page can still show it offline.
const SNAPSHOT_KEY = 'prepzy-account-snapshot';
const SNAPSHOT_TIME_KEY = 'prepzy-account-snapshot-at';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function readSnapshot(): { profile: Profile; savedAt: string | null } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const time = Number(localStorage.getItem(SNAPSHOT_TIME_KEY));
    const savedAt = time
      ? new Date(time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
      : null;
    return { profile: JSON.parse(raw) as Profile, savedAt };
  } catch {
    return null;
  }
}

/** Plan row and chips: competitive exams read the plan summary, board exams the selected class's plan. */
function usePlanDetails() {
  const exam = useExam();
  const catalog = useExamCatalog();
  const plans = usePlans(exam);
  const activePlan = useActivePlan(exam).data ?? null;
  const summary = usePlanSummary(exam).data ?? null;
  const competitive = exam.category === 'competitive';

  const examName = catalog.data?.find((e) => e.examId === exam.examId)?.name ?? exam.label;
  const classLabel = activePlan?.className
    ? `${activePlan.className}${activePlan.streamName ? ` (${activePlan.streamName})` : ''}`
    : '';
  const months = activePlan?.durationMonths ?? 0;
  const boardPlanName = months ? `${months} Month${months > 1 ? 's' : ''}` : '';
  const planName =
    competitive && summary ? (summary.isFreeForever ? 'Free' : capitalize(summary.planType)) : boardPlanName;

  const chips: Chip[] = [
    { label: examName },
    ...(classLabel ? [{ label: classLabel }] : []),
    ...(planName ? [{ label: planName, highlight: true }] : []),
  ];

  const morePlans = Math.max((plans.data ?? []).filter((p) => p.status === 'active').length - 1, 0);
  const withMore = (name: string) => (morePlans > 0 ? `${name} & ${morePlans}+ Plans` : name);

  let plan: PlanInfo | null = null;
  if (competitive && summary) {
    const validity = summary.isFreeForever
      ? 'Free forever'
      : summary.expiryDate
        ? `Valid till ${summary.expiryDate}`
        : capitalize(summary.status.toLowerCase());
    plan = {
      title: withMore([summary.planName, classLabel].filter(Boolean).join(' · ')),
      subtitle: validity,
      mobileTitle: withMore(summary.planName),
      mobileSubtitle: validity,
    };
  } else if (!competitive && activePlan) {
    const validTill = activePlan.expiryDate ? `Valid till ${formatDay(activePlan.expiryDate)}` : '';
    plan = {
      title: withMore(
        [boardPlanName && `${boardPlanName} plan`, classLabel].filter(Boolean).join(' · ') || 'Your plan',
      ),
      subtitle: validTill,
      mobileTitle: withMore(boardPlanName ? `${boardPlanName} plan` : 'Your plan'),
      mobileSubtitle: validTill,
    };
  }

  return { chips, classLabel, plan };
}

/** My Account: profile card (or the edit column at ?edit=1), plan, more, log out and delete. */
export function AccountScreen() {
  const exam = useExam();
  const router = useRouter();
  const profileQuery = useProfile();
  const logout = useLogout();
  const offline = useOffline();
  const { chips, classLabel, plan } = usePlanDetails();

  const isEditing = useSearchParams().get('edit') === '1';
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Set once a delete request is saved; the session has ended, so the result replaces the page.
  const [deleteResult, setDeleteResult] = useState<DeleteResultInfo | null>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof readSnapshot>>(null);

  const live = profileQuery.data;
  useEffect(() => {
    if (!live || offline) return;
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(live));
      localStorage.setItem(SNAPSHOT_TIME_KEY, String(Date.now()));
    } catch {
      // Storage blocked: the offline view just won't be available.
    }
  }, [live, offline]);

  useEffect(() => setSnapshot(offline ? readSnapshot() : null), [offline]);

  const profile = live ?? (offline ? snapshot?.profile : undefined);
  const dashboardHref = routes.dashboard(exam.slug);
  const helpHref = routes.profileHelp(exam.slug);

  const heading = (loading = false) => (
    <>
      <div className="flex items-center gap-[10px] lg:hidden">
        <Link href={isEditing ? routes.profile(exam.slug) : dashboardHref} aria-label="Back" className="flex shrink-0">
          <Icon name="back-mobile.svg" size={22} />
        </Link>
        <h1 className="text-account-ink text-[22px] leading-normal font-bold">
          {isEditing ? 'Edit profile' : 'My Account'}
        </h1>
      </div>
      {loading ? (
        <AccountDesktopHeadingSkeleton />
      ) : (
        <div className="hidden flex-col gap-[4px] lg:flex">
          <Link href={dashboardHref} className="flex w-fit items-center gap-[6px] no-underline">
            <Icon name="back.svg" size={16} />
            <span className="text-brand text-[13px] font-semibold">Back to Dashboard</span>
          </Link>
          <h1 className="text-brand mt-[8px] text-[24px] leading-normal font-bold">My Account</h1>
          <p className="text-neutral-550 text-[13px] leading-normal">
            Your profile, plan and how you study, in one place.
          </p>
        </div>
      )}
    </>
  );

  if (deleteResult) return <DeleteResult info={deleteResult} />;

  const openDeleteAccount = () => {
    if (isDesktop()) setDeleteOpen(true);
    else router.push(routes.requestAccountDelete(exam.slug));
  };

  if (!profile) {
    return (
      <div className={pageContainer}>
        {heading(profileQuery.isPending)}
        {profileQuery.isPending && !offline ? (
          <AccountSkeleton />
        ) : (
          <ErrorState
            title="We couldn’t load your account"
            text="This is on our side. Your plan and progress are safe."
            onRetry={() => profileQuery.refetch()}
            linkLabel="Contact support"
            onLink={() => router.push(helpHref)}
          />
        )}
      </div>
    );
  }

  const openEdit = () => router.push(routes.profileEdit(exam.slug));

  return (
    <div className="w-full">
      {offline && (
        <OfflineBanner
          message={`You’re offline.${snapshot?.savedAt ? ` Showing your account as saved at ${snapshot.savedAt}.` : ''} Changes need internet.`}
          onRetry={() => {
            if (navigator.onLine) profileQuery.refetch();
          }}
        />
      )}
      <div className={pageContainer}>
        {heading()}
        <div className="flex w-full flex-col items-start gap-[16px] lg:flex-row lg:gap-[24px]">
          {isEditing ? (
            <>
              <EditColumn profile={profile} />
              <div className="flex w-full flex-col gap-[16px] lg:hidden">
                <p className="bg-account-soft text-neutral-550 rounded-[12px] px-[14px] py-[12px] text-[12px] leading-normal">
                  Course and class live in My Account → Course, not here.
                </p>
                <button
                  type="button"
                  onClick={openDeleteAccount}
                  disabled={offline}
                  className="text-neutral-550 w-full py-[4px] text-[13px] font-medium underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete account
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="hidden lg:contents">
                <ProfileCard profile={profile} chips={chips} onEdit={openEdit} />
              </div>
              <div className="contents lg:hidden">
                <MobileProfileCard profile={profile} classLabel={classLabel} offline={offline} onEdit={openEdit} />
              </div>
            </>
          )}
          <div className={`${isEditing ? 'hidden lg:flex' : 'flex'} w-full min-w-0 flex-1`}>
            <AccountSettings
              plan={plan}
              offline={offline}
              onManagePlans={() => router.push(routes.managePlans())}
              onOpenParent={() => router.push(routes.profileParent(exam.slug))}
              onOpenHelp={() => router.push(helpHref)}
              onOpenRefer={() => router.push(routes.referAndEarn(exam.slug))}
              onDeleteAccount={openDeleteAccount}
              onLogout={() => setConfirmLogout(true)}
              loggingOut={logout.isPending}
            />
          </div>
        </div>
      </div>
      {confirmLogout && (
        <LogoutConfirm
          busy={logout.isPending}
          onConfirm={() => logout.mutate()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
      {deleteOpen && (
        <DeleteAccountModal
          onClose={() => setDeleteOpen(false)}
          onDone={(info) => {
            setDeleteOpen(false);
            setDeleteResult(info);
          }}
        />
      )}
    </div>
  );
}
