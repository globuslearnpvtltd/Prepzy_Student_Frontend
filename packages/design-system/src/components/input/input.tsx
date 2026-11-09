import type { ComponentProps } from 'react';
import { componentClass, splitVariantProps, type VariantProps } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> &
  VariantProps<'input'> & {
    /** Marks the field as invalid (sets aria-invalid and the config's `invalid` styles). */
    invalid?: boolean;
  };

export type TextareaProps = ComponentProps<'textarea'> & { invalid?: boolean };

/** Multi-line input styled by `components.textarea` in design.config.ts. */
export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea className={cx(componentClass('textarea'), className)} aria-invalid={invalid || undefined} {...props} />
  );
}

/** Text input styled by `components.input` in design.config.ts (props: size). */
export function Input({ className, invalid, ...props }: InputProps) {
  const [variantAttributes, rest] = splitVariantProps('input', props);
  return (
    <input
      className={cx(componentClass('input'), className)}
      aria-invalid={invalid || undefined}
      {...variantAttributes}
      {...rest}
    />
  );
}
