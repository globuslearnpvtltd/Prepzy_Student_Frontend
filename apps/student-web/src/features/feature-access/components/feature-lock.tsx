'use client';

import { cx } from '@prepzy/design-system';
import { Lock } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { showFeatureRestricted, useFeatureAccess } from '../hooks';
import { featureList, RESTRICTED_COPY, type FeatureKeys } from '../keys';

/** The padlock badge of a restricted entry point (the board sidebar's padlock style). */
export function LockBadge({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      title={RESTRICTED_COPY.tooltip}
      className={cx(
        'bg-surface text-brand shadow-sm flex shrink-0 items-center justify-center',
        size === 'sm' ? 'size-5 rounded-full' : 'size-6 rounded-[6px]',
        className,
      )}
    >
      <Lock aria-label={RESTRICTED_COPY.tooltip} className={size === 'sm' ? 'size-3' : 'size-3.5'} />
    </span>
  );
}

/**
 * Wraps an entry point (link, button, card) of a feature the institute may switch off. When it's restricted the
 * child stays visible but dimmed and inert, with a padlock badge and a tooltip; clicking it opens the "not enabled by
 * your institute" dialog instead. Otherwise the child renders untouched (also while access is loading).
 */
export function FeatureLock({
  feature,
  label,
  children,
  className,
  badge = 'corner',
  as: Tag = 'div',
}: {
  feature: FeatureKeys | null | undefined;
  /** Accessible name of the locked control (its content is inert, so it doesn't name it). */
  label: string;
  children: ReactNode;
  className?: string;
  /** corner: padlock inside the top-right corner (cards); edge: on the top-right edge (buttons); none: no badge. */
  badge?: 'corner' | 'edge' | 'none';
  as?: 'div' | 'span' | 'li';
}) {
  const { isRestricted } = useFeatureAccess();
  if (!feature || !isRestricted(feature)) return <>{children}</>;
  const first = featureList(feature)[0] ?? null;
  const Inner = Tag === 'span' ? 'span' : 'div';
  const open = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    showFeatureRestricted(first);
  };
  return (
    <Tag
      role="button"
      tabIndex={0}
      aria-disabled="true"
      aria-label={`${label} (${RESTRICTED_COPY.tooltip.toLowerCase()})`}
      title={RESTRICTED_COPY.tooltip}
      data-feature-locked={featureList(feature).join(' ')}
      onClickCapture={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') open(event);
      }}
      className={cx('relative cursor-not-allowed', Tag === 'span' ? 'inline-block' : 'block', className)}
    >
      {/* inert: nothing inside can be focused or clicked (the click lands on this wrapper). */}
      <Inner inert aria-hidden="true" className={cx('opacity-60 grayscale-[40%]', Tag === 'span' ? 'inline' : 'block')}>
        {children}
      </Inner>
      {badge === 'corner' && <LockBadge className="absolute top-2 right-2 z-[1]" />}
      {badge === 'edge' && <LockBadge size="sm" className="absolute -top-2 -right-2 z-[1]" />}
    </Tag>
  );
}
