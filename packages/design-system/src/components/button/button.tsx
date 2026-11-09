import { Slot, Slottable } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { componentClass, splitVariantProps, type VariantProps } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<'button'> & {
    /** Render the child element (e.g. a Next.js <Link>) with button styling instead of a <button>. */
    asChild?: boolean;
    /** Shows a spinner and blocks interaction. */
    loading?: boolean;
  };

/** Button styled by `components.button` in design.config.ts (props: intent, size, width). */
export function Button({
  asChild = false,
  loading = false,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const [variantAttributes, rest] = splitVariantProps('button', props);
  const isDisabled = disabled || loading;
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      className={cx(componentClass('button'), className)}
      {...variantAttributes}
      {...rest}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : isDisabled}
      aria-disabled={asChild && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
    >
      {loading && <span className="pz-button__spinner" aria-hidden="true" />}
      <Slottable>{children}</Slottable>
    </Component>
  );
}
