import type { ComponentProps } from 'react';
import { componentClass } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

/**
 * One bordered control made of a prefix (country code, icon …) and an input.
 * Styled by `components.input-group` in design.config.ts.
 */
export function InputGroup({ className, invalid, ...props }: ComponentProps<'div'> & { invalid?: boolean }) {
  return (
    <div className={cx(componentClass('input-group'), className)} aria-invalid={invalid || undefined} {...props} />
  );
}

export function InputGroupPrefix({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('input-group', 'prefix'), className)} {...props} />;
}

export function InputGroupInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(componentClass('input-group', 'input'), className)} {...props} />;
}
