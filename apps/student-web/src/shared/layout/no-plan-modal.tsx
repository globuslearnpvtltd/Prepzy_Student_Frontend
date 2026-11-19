'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle, cx } from '@prepzy/design-system';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';

/** The four-point sparkle of the previous app's upgrade card. */
const SPARKLE =
  'M13.4267 5.58606L10.4537 3.99205C10.2677 3.89205 10.1167 3.74006 10.0167 3.55506L8.42273 0.582066C8.01973 -0.169934 6.94072 -0.169934 6.53772 0.582066L4.94373 3.55506C4.84373 3.74106 4.69172 3.89305 4.50672 3.99205L1.53373 5.58606C0.781727 5.98906 0.781727 7.06806 1.53373 7.47106L4.50672 9.06505C4.69272 9.16505 4.84473 9.31706 4.94373 9.50206L6.53772 12.4751C6.94072 13.2271 8.01973 13.2271 8.42273 12.4751L10.0167 9.50206C10.1167 9.31706 10.2687 9.16405 10.4537 9.06505L13.4267 7.47106C14.1787 7.06806 14.1787 5.99006 13.4267 5.58606Z';

/** Decorations of the blue band, placed as in the previous app (size in px, white or light blue). */
const DECOR: { at: string; size: number; dot?: boolean; light?: boolean }[] = [
  { at: 'bottom-[37%] right-[22%]', size: 5, dot: true },
  { at: 'bottom-[60%] right-[17%]', size: 14 },
  { at: 'top-[66%] left-[25%]', size: 14 },
  { at: 'top-[50%] left-[14%]', size: 6, dot: true },
  { at: 'top-[14%] left-[19%]', size: 14, light: true },
  { at: 'top-[35%] left-[33%]', size: 9, light: true },
  { at: 'top-[50%] left-[60%]', size: 9, light: true },
  { at: 'top-[16%] right-[29%]', size: 5, dot: true, light: true },
];

/**
 * Shown on an exam's pages when the student has no plan for that exam (previous app's ExamUpgradeBlockScreen, as a
 * modal): a blue band with the rocket, "No plan purchased for {exam}" and Upgrade Now → the purchase page for this
 * exam. When the student owns another exam, a second button opens that exam's dashboard. It can't be dismissed: the
 * exam's pages need a plan.
 */
export function NoPlanModal({
  exam,
  ownedExam,
}: {
  exam: { slug: string; label: string };
  ownedExam?: { slug: string; label: string } | null;
}) {
  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="w-[345px] max-w-[calc(100%-32px)] gap-0 overflow-hidden rounded-2xl border-[1.5px] p-0 md:w-[457px]"
      >
        <div className="bg-info-600 relative h-[189px] shrink-0">
          {DECOR.map(({ at, size, dot, light }) => (
            <svg
              key={at}
              aria-hidden
              width={size}
              height={size}
              viewBox={dot ? '0 0 6 6' : '0 0 14 14'}
              className={cx('absolute', at, light ? 'text-info-200' : 'text-on-brand')}
            >
              {dot ? <circle cx="3" cy="3" r="3" fill="currentColor" /> : <path d={SPARKLE} fill="currentColor" />}
            </svg>
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element -- small static illustration */}
          <img
            src="/illustrations/plans/upgrade-rocket.svg"
            alt=""
            width={77}
            height={189}
            className="absolute top-5 left-1/2 -translate-x-1/2"
          />
        </div>
        <div className="px-6 pt-8 pb-6 text-center">
          <DialogTitle className="mb-3 text-[20px] leading-7 font-semibold text-neutral-950">
            No plan purchased for {exam.label}
          </DialogTitle>
          <DialogDescription className="mb-8 text-[14px] leading-relaxed text-neutral-600">
            You don&apos;t have an active plan for {exam.label} yet. Purchase a plan to unlock this exam.
          </DialogDescription>
          <Link
            href={routes.plansPurchase(exam.slug)}
            className="bg-info-400 hover:bg-info-650 text-on-brand flex w-full items-center justify-center rounded-lg px-6 py-3 font-medium transition-colors duration-200"
          >
            Upgrade Now
          </Link>
          {ownedExam && (
            <Link
              href={routes.dashboard(ownedExam.slug)}
              className="text-info-600 mt-3 flex w-full items-center justify-center rounded-lg px-6 py-2.5 text-[14px] font-medium hover:underline"
            >
              Go to my {ownedExam.label} dashboard
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
