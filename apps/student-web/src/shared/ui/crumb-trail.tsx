'use client';

import { cx } from '@prepzy/design-system';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A breadcrumb trail that never scrolls sideways: when the crumbs don't fit, the leading ones fold into a "…" button
 * at the start of the trail, which opens a menu of the hidden crumbs. The current (last) crumb always stays and is cut
 * with an ellipsis when even it alone doesn't fit.
 *
 * The trail is measured from an invisible copy with every crumb, kept in the layout with no height, so the trail
 * still asks for its full width and opens up again when there is room.
 */

export interface TrailCrumb {
  label: string;
  href?: string;
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The fewest leading crumbs to hide so the rest (plus the "…" button when any are hidden) fits in `available`. */
export function crumbsToHide({
  available,
  items,
  separator,
  dots,
  gap,
}: {
  available: number;
  items: number[];
  separator: number;
  dots: number;
  gap: number;
}): number {
  const n = items.length;
  for (let hidden = 0; hidden < n; hidden += 1) {
    const shown = items.slice(hidden);
    const widths = [...(hidden > 0 ? [dots, separator] : []), ...shown.flatMap((w, i) => (i < shown.length - 1 ? [w, separator] : [w]))];
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
    if (total <= available + 0.5) return hidden;
  }
  return Math.max(0, n - 1);
}

export function CrumbTrail({
  crumbs,
  renderCrumb,
  separator,
  className,
  outerClassName,
  label = 'Breadcrumb',
}: {
  crumbs: TrailCrumb[];
  /** How a crumb looks in the trail (link, plain text or the current page). */
  renderCrumb: (crumb: TrailCrumb, info: { index: number; last: boolean }) => ReactNode;
  separator: ReactNode;
  /** The trail box: background, border, padding and gap. */
  className?: string;
  /** The space the trail may use (e.g. `flex-1`, `hidden sm:flex`). */
  outerClassName?: string;
  label?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const box = outer.current;
    const row = copy.current;
    if (!box || !row) return;
    const parts = Array.from(row.children) as HTMLElement[];
    const width = (el: HTMLElement | undefined) => el?.getBoundingClientRect().width ?? 0;
    const dots = width(parts.find((el) => el.dataset.part === 'dots'));
    const separatorWidth = width(parts.find((el) => el.dataset.part === 'separator'));
    const items = parts.filter((el) => el.dataset.part === 'crumb').map(width);
    const style = window.getComputedStyle(row);
    const gap = parseFloat(style.columnGap) || 0;
    const chrome =
      (parseFloat(style.paddingLeft) || 0) +
      (parseFloat(style.paddingRight) || 0) +
      (parseFloat(style.borderLeftWidth) || 0) +
      (parseFloat(style.borderRightWidth) || 0);
    const available = box.getBoundingClientRect().width - chrome;
    if (available <= 0) return;
    setHidden(crumbsToHide({ available, items, separator: separatorWidth, dots, gap }));
  }, []);

  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, crumbs, hidden]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    if (outer.current) observer.observe(outer.current);
    if (copy.current) observer.observe(copy.current);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hiddenCount = Math.min(hidden, Math.max(0, crumbs.length - 1));
  const shown = crumbs.slice(hiddenCount);
  const folded = crumbs.slice(0, hiddenCount);
  const dotsClass = 'text-brand hover:bg-brand-50 flex h-6 shrink-0 items-center justify-center rounded-md px-1';

  return (
    <div ref={outer} className={cx('flex min-w-0 flex-col', outerClassName)}>
      <nav aria-label={label} className={cx('flex w-fit max-w-full min-w-0 items-center', className)}>
        {hiddenCount > 0 && (
          <>
            <div ref={menu} className="relative flex shrink-0">
              <button
                type="button"
                aria-label={`Show ${hiddenCount} more`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={dotsClass}
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </button>
              {open && (
                <div
                  role="menu"
                  className="bg-surface absolute top-full left-0 z-50 mt-2 flex max-w-[min(320px,80vw)] min-w-[200px] flex-col rounded-xl border border-neutral-100 py-1.5 shadow-lg"
                >
                  {folded.map((crumb, index) =>
                    crumb.href ? (
                      <Link
                        key={`${crumb.label}-${index}`}
                        role="menuitem"
                        href={crumb.href}
                        onClick={() => setOpen(false)}
                        className="text-brand hover:bg-brand-50 truncate px-4 py-2 text-sm font-semibold"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span key={`${crumb.label}-${index}`} role="menuitem" aria-disabled className="truncate px-4 py-2 text-sm font-medium text-neutral-550">
                        {crumb.label}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
            <span aria-hidden className="flex shrink-0 items-center">
              {separator}
            </span>
          </>
        )}
        {shown.map((crumb, i) => {
          const index = i + hiddenCount;
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <span className={cx('flex items-center whitespace-nowrap', last ? 'min-w-0 overflow-hidden [&_*]:truncate' : 'shrink-0')} title={last ? crumb.label : undefined}>
                {renderCrumb(crumb, { index, last })}
              </span>
              {!last && (
                <span aria-hidden className="flex shrink-0 items-center">
                  {separator}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
      {/* Every crumb, unseen: measures the trail and keeps its full width as the space it asks for. */}
      <div aria-hidden className="pointer-events-none invisible h-0 overflow-hidden" inert>
        <div ref={copy} className={cx('flex w-max items-center', className)}>
          <span data-part="dots" className={dotsClass}>
            <MoreHorizontal className="size-4" />
          </span>
          <span data-part="separator" className="flex shrink-0 items-center">
            {separator}
          </span>
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} data-part="crumb" className="flex shrink-0 items-center whitespace-nowrap">
              {renderCrumb(crumb, { index, last: index === crumbs.length - 1 })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
