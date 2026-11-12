'use client';

import { cx } from '@prepzy/design-system';
import { Check, ChevronDown } from 'lucide-react';
import { Fragment } from 'react';
import { columnEyebrow, priceSection, type Cell, type CompareSection, type Plan } from '../../catalog';

function CellValue({ value, strong }: { value: Cell; strong: boolean }) {
  if (value === true) return <Check aria-label="Included" size={16} strokeWidth={3} className="text-success mx-auto" />;
  if (value === false) return <span className="text-plan-divider">—</span>;
  return <span className={strong ? 'text-plan-violet-deep font-bold' : 'font-medium text-neutral-700'}>{value}</span>;
}

const DIVIDER = 'border-plan-divider border-l';

/** Feature limits and prices side by side; the last (longest) plan's column is highlighted. */
export function ComparePlans({
  plans,
  sections,
  expanded,
  onToggle,
}: {
  plans: Plan[];
  sections: CompareSection[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const last = plans.length - 1;
  const all = [...sections, priceSection(plans)];
  return (
    <section className="mt-11 md:mt-14" aria-labelledby="compare-plans">
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <h2 id="compare-plans" className="text-plan-violet-deep text-xl font-bold md:text-[22px]">
          Compare Plans
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-plan-violet inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold hover:opacity-80 md:text-[14px]"
        >
          {expanded ? 'View less' : 'View All Limits'}
          <ChevronDown aria-hidden size={15} className={cx('transition-transform duration-300', expanded && 'rotate-180')} />
        </button>
      </div>
      <div
        className={cx(
          'border-plan-divider bg-surface overflow-hidden rounded-lg border shadow-[0_1px_3px_rgba(37,28,81,0.06)] transition-[max-height] duration-500',
          expanded ? 'max-h-[3600px]' : 'max-h-[258px] md:max-h-[272px]',
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-center">
            <colgroup>
              <col className="w-[34%] md:w-[28%]" />
              {plans.map((plan) => (
                <col key={plan.priceId} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-plan-divider border-b">
                <th className="bg-plan-head sticky left-0 z-10 px-5 py-4 md:px-7" />
                {plans.map((plan, index) => (
                  <th
                    key={plan.priceId}
                    scope="col"
                    className={cx(DIVIDER, 'px-3 py-4 md:px-4 md:py-[18px]', index === last ? 'bg-plan-head-hl' : 'bg-plan-head')}
                  >
                    <span
                      className={cx(
                        'block text-[9px] tracking-[0.12em] uppercase md:text-[10px]',
                        index === last ? 'text-plan-violet-deep font-bold' : 'text-plan-label font-medium',
                      )}
                    >
                      {columnEyebrow(plan)}
                    </span>
                    <span className="text-plan-ink mt-1 block text-[14px] leading-snug font-bold break-words md:text-[17px]">{plan.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map((section) => (
                <Fragment key={section.title}>
                  <tr className="border-plan-line border-t">
                    <td className="bg-plan-section text-plan-violet-deep sticky left-0 z-10 px-5 py-[13px] text-left text-[9px] font-bold tracking-[0.14em] uppercase md:px-7 md:text-[10px]">
                      {section.title}
                    </td>
                    {plans.map((plan, index) => (
                      <td key={plan.priceId} className={cx(DIVIDER, index === last ? 'bg-plan-section-hl' : 'bg-plan-section')} />
                    ))}
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={`${section.title}-${row.label}`} className="border-plan-line border-t">
                      <th
                        scope="row"
                        className="bg-surface text-brand-600 sticky left-0 z-10 px-5 py-3.5 text-left text-[12px] font-normal md:px-7 md:py-4 md:text-[13px]"
                      >
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={index}
                          className={cx(
                            DIVIDER,
                            'px-3 py-3.5 text-[12px] md:px-4 md:py-4 md:text-[13px]',
                            index === last ? 'bg-plan-body-hl' : 'bg-surface',
                          )}
                        >
                          <CellValue value={value} strong={index === last} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
