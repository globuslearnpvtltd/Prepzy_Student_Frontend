import { cx } from '@prepzy/design-system';
import type { ReactNode } from 'react';
import { Bone, card, Line } from '../kit';

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bg-surface border-account-line rounded-[16px] border px-[16px] pt-[20px] pb-[8px] lg:px-[20px]">
      <Bone className="h-[8px] w-[60px]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cx('flex items-center gap-[14px] py-[14px]', i < rows - 1 && 'border-account-line border-b')}
        >
          <Bone className="size-[36px] shrink-0 rounded-[10px]" />
          <div className="flex flex-1 flex-col gap-[10px]">
            <Bone className="h-[10px] w-full max-w-[286px]" />
            <Bone className="h-[9px] w-full max-w-[286px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="flex w-full flex-col gap-[16px] lg:hidden">
      <div className="bg-account-bone flex w-full flex-col gap-[14px] rounded-[20px] p-[16px]">
        <div className="h-[56px]" />
        <div className="bg-surface flex h-[44px] items-center justify-center rounded-full">
          <Bone className="h-[10px] w-[75px]" />
        </div>
      </div>
      <GroupSkeleton rows={1} />
      <GroupSkeleton rows={5} />
    </div>
  );
}

function DesktopRow({ action, last }: { action?: ReactNode; last?: boolean }) {
  return (
    <div className={cx('flex items-center gap-[14px] py-[14px]', !last && 'border-account-line border-b')}>
      <Bone className="size-[36px] shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <Line height={21}>
          <Bone className="h-[10px] w-full" />
        </Line>
        <Line height={18}>
          <Bone className="h-[9px] w-full" />
        </Line>
      </div>
      {action ?? <div className="w-[16px] shrink-0" />}
    </div>
  );
}

/** titleWidth matches the real group title (PLAN / MORE). */
function DesktopGroup({ titleWidth, children }: { titleWidth: number; children: ReactNode }) {
  return (
    <div className={cx(card, 'px-[20px] pt-[20px] pb-[8px]')}>
      <div className="mb-[6px] flex h-[17px] items-center">
        <Bone className="h-[8px]" width={titleWidth} />
      </div>
      {children}
    </div>
  );
}

export function AccountDesktopHeadingSkeleton() {
  return (
    <div className="hidden flex-col lg:flex" aria-hidden="true">
      <Line height={20} className="pl-[22px]">
        <Bone className="h-[9px] w-[126px]" />
      </Line>
      <Line height={36} className="mt-[16px]">
        <Bone className="h-[17px] w-[147px]" />
      </Line>
      <Line height={20} className="mt-[4px]">
        <Bone className="h-[9px] w-[324px]" />
      </Line>
    </div>
  );
}

function DesktopSkeleton() {
  return (
    <div className="hidden w-full items-start gap-[24px] lg:flex">
      <div className={cx(card, 'flex w-[320px] shrink-0 flex-col items-center gap-[16px] p-[24px]')}>
        <Bone className="size-[88px] rounded-full" />
        <div className="flex flex-col items-center gap-[2px]">
          <Line height={30}>
            <Bone className="h-[14px] w-[68px]" />
          </Line>
          <Line height={20}>
            <Bone className="h-[9px] w-[103px]" />
          </Line>
        </div>
        <div className="flex gap-[8px]">
          <Bone className="h-[25px] w-[49px] rounded-full" />
          <Bone className="h-[25px] w-[103px] rounded-full" />
          <Bone className="h-[25px] w-[60px] rounded-full" />
        </div>
        <Bone className="h-[85px] w-full rounded-[12px]" />
        <div className="border-account-outline flex h-[47px] w-full items-center justify-center rounded-full border">
          <Bone className="h-[10px] w-[75px]" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[20px]">
        <DesktopGroup titleWidth={31}>
          <DesktopRow last action={<Bone className="h-[34px] w-[120px] shrink-0 rounded-full" />} />
        </DesktopGroup>
        <DesktopGroup titleWidth={35}>
          <DesktopRow />
          <DesktopRow />
          <DesktopRow />
          <DesktopRow />
          <DesktopRow last />
        </DesktopGroup>
        <div className={cx(card, 'flex h-[51px] items-center justify-center')}>
          <Bone className="h-[10px] w-[76px]" />
        </div>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-label="Loading your account">
      <MobileSkeleton />
      <DesktopSkeleton />
    </div>
  );
}
