import * as ProgressPrimitive from '@radix-ui/react-progress';
import type { ComponentProps } from 'react';
import { componentClass, splitVariantProps, type VariantProps } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

export type BadgeProps = ComponentProps<'span'> & VariantProps<'badge'>;

/** Small status label. Styled by `components.badge` (prop: tone). */
export function Badge({ className, ...props }: BadgeProps) {
  const [variantAttributes, rest] = splitVariantProps('badge', props);
  return <span className={cx(componentClass('badge'), className)} {...variantAttributes} {...rest} />;
}

export type AlertProps = ComponentProps<'div'> & VariantProps<'alert'>;

/** Inline message. Danger alerts interrupt screen readers; others are polite. Styled by `components.alert`. */
export function Alert({ className, tone, ...props }: AlertProps) {
  const [variantAttributes, rest] = splitVariantProps('alert', { tone, ...props });
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(componentClass('alert'), className)}
      {...variantAttributes}
      {...rest}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cx(componentClass('alert', 'title'), className)} {...props} />;
}

export type SpinnerProps = ComponentProps<'span'> & VariantProps<'spinner'> & { label?: string };

/** Loading indicator. Styled by `components.spinner` (prop: size). */
export function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  const [variantAttributes, rest] = splitVariantProps('spinner', props);
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(componentClass('spinner'), className)}
      {...variantAttributes}
      {...rest}
    />
  );
}

/** Placeholder block shown while content loads. Size it with utility classes (h-4 w-32). */
export function Skeleton({ className, ...props }: ComponentProps<'span'>) {
  return <span aria-hidden="true" className={cx(componentClass('skeleton'), className)} {...props} />;
}

export type ProgressProps = Omit<ComponentProps<typeof ProgressPrimitive.Root>, 'value' | 'max'> &
  VariantProps<'progress'> & { value: number; max?: number };

/** Progress bar. Styled by `components.progress` (prop: tone). */
export function Progress({ className, value, max = 100, ...props }: ProgressProps) {
  const [variantAttributes, rest] = splitVariantProps('progress', props);
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <ProgressPrimitive.Root
      className={cx(componentClass('progress'), className)}
      value={clamped}
      max={max}
      {...variantAttributes}
      {...rest}
    >
      <ProgressPrimitive.Indicator
        className={componentClass('progress', 'indicator')}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
