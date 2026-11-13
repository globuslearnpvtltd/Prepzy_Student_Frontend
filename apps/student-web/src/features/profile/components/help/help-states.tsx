import { cx } from '@prepzy/design-system';
import { Bone, card, Icon, Line } from '../kit';

export function HelpHeadingSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-[16px] lg:hidden" aria-hidden="true">
        <div className="flex h-[33px] items-center gap-[10px]">
          <Icon name="back-mobile.svg" size={22} />
          <Bone className="h-[16px]" width={195} />
        </div>
        <Line height={18}>
          <Bone className="h-[9px] w-full" />
        </Line>
      </div>
      <div className="hidden flex-col lg:flex" aria-hidden="true">
        <Line height={20} className="pl-[22px]">
          <Bone className="h-[9px]" width={131} />
        </Line>
        <Line height={36} className="mt-[16px]">
          <Bone className="h-[17px]" width={213} />
        </Line>
        <Line height={20} className="mt-[4px]">
          <Bone className="h-[9px]" width={326} />
        </Line>
      </div>
    </>
  );
}

function RowsCard({ titleWidth, rows, twoLine }: { titleWidth: number; rows: number[][]; twoLine: boolean }) {
  return (
    <div className={cx(card, 'flex flex-col px-[16px] pt-[14px] pb-[6px]')}>
      <Line height={17}>
        <Bone className="h-[8px]" width={titleWidth} />
      </Line>
      {rows.map(([a, b], i) => (
        <div
          key={i}
          className={cx(
            'flex items-center gap-[12px] py-[12px]',
            i < rows.length - 1 && 'border-account-line border-b',
          )}
        >
          {twoLine && <Bone className="size-[34px] shrink-0 rounded-[10px]" />}
          <div className="flex flex-1 flex-col gap-[2px]">
            <Line height={21}>
              <Bone className="h-[10px]" width={a} />
            </Line>
            {b ? (
              <Line height={18}>
                <Bone className="h-[9px]" width={b} />
              </Line>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// Bones in order: search, chips, Talk to us, Top questions, Your requests, Report button.
function MobileSkeleton() {
  return (
    <div className="flex w-full flex-col gap-[16px] lg:hidden" aria-busy="true" aria-label="Loading help">
      <div className="bg-surface border-account-outline flex h-[47px] items-center rounded-[12px] border pl-[43px]">
        <Bone className="h-[10px]" width={84} />
      </div>
      <div className="flex flex-wrap gap-[8px]">
        {[125, 32, 45, 68].map((w, i) => (
          <div key={i} className="bg-account-tile flex h-[32px] items-center rounded-full px-[12px]">
            <Bone className="h-[9px]" width={w} />
          </div>
        ))}
      </div>
      <RowsCard
        titleWidth={62}
        rows={[
          [89, 149],
          [49, 152],
        ]}
        twoLine
      />
      <RowsCard
        titleWidth={87}
        rows={[
          [216, 0],
          [151, 0],
          [200, 0],
        ]}
        twoLine={false}
      />
      <div className={cx(card, 'flex flex-col px-[16px] pt-[14px] pb-[6px]')}>
        <Line height={17}>
          <Bone className="h-[8px]" width={88} />
        </Line>
        <div className="flex items-center gap-[12px] py-[12px]">
          <div className="flex flex-1 flex-col gap-[2px]">
            <Line height={21}>
              <Bone className="h-[10px]" width={144} />
            </Line>
            <Line height={18}>
              <Bone className="h-[9px]" width={129} />
            </Line>
          </div>
          <Bone className="h-[8px]" width={63} />
        </div>
      </div>
      <div className="border-account-outline flex h-[51px] items-center justify-center rounded-full border">
        <Bone className="h-[10px]" width={125} />
      </div>
    </div>
  );
}

function DesktopSkeleton() {
  return (
    <div className="hidden w-full flex-row items-start gap-[24px] lg:flex" aria-busy="true" aria-label="Loading help">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-[16px] lg:gap-[20px]">
        <div className={cx(card, 'flex flex-col gap-[14px] p-[20px]')}>
          <div className="border-account-outline flex h-[46px] items-center rounded-[12px] border px-[43px]">
            <Bone className="h-[9px] w-full max-w-[299px]" />
          </div>
          <div className="flex flex-wrap gap-[8px]">
            {[125, 103, 45, 68].map((w) => (
              <div key={w} className="bg-account-soft flex h-[32px] items-center rounded-full px-[14px]">
                <Bone className="h-[9px]" width={w} />
              </div>
            ))}
          </div>
        </div>
        <div className={cx(card, 'flex flex-col gap-[14px] p-[20px]')}>
          <Line height={17}>
            <Bone className="h-[8px]" width={87} />
          </Line>
          {[216, 151, 288, 200].map((w, i) => (
            <div key={w} className={cx('py-[12px]', i < 3 && 'border-account-line border-b')}>
              <Line height={21}>
                <Bone className="h-[10px] max-w-full" width={w} />
              </Line>
            </div>
          ))}
        </div>
      </div>
      <div className={cx(card, 'flex w-full shrink-0 flex-col gap-[14px] p-[20px] lg:w-[380px]')}>
        <Line height={17}>
          <Bone className="h-[8px]" width={62} />
        </Line>
        {[
          [89, 149],
          [60, 109],
        ].map(([a, b], i) => (
          <div
            key={a}
            className={cx('flex items-center gap-[12px] py-[12px]', i === 0 && 'border-account-line border-b')}
          >
            <Bone className="size-[36px] shrink-0 rounded-[10px]" />
            <div className="flex flex-col gap-[2px]">
              <Line height={21}>
                <Bone className="h-[10px]" width={a} />
              </Line>
              <Line height={18}>
                <Bone className="h-[9px]" width={b} />
              </Line>
            </div>
          </div>
        ))}
        <div className="border-account-outline flex h-[36px] items-center justify-center rounded-full border">
          <Bone className="h-[9px]" width={107} />
        </div>
      </div>
    </div>
  );
}

export function HelpSkeleton() {
  return (
    <>
      <MobileSkeleton />
      <DesktopSkeleton />
    </>
  );
}
