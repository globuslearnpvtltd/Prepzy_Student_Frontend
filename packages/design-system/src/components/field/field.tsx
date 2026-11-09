import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps } from 'react';
import { componentClass } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

/** Groups a label, control, hint and error. Styled by `components.field`. */
export function Field({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('field'), className)} {...props} />;
}

export function FieldLabel({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cx(componentClass('field', 'label'), className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cx(componentClass('field', 'hint'), className)} {...props} />;
}

/** Validation message; announced to screen readers when it appears. Renders nothing when empty. */
export function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null;
  return (
    <p role="alert" className={cx(componentClass('field', 'error'), className)} {...props}>
      {children}
    </p>
  );
}
