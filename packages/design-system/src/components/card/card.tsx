import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { componentClass, splitVariantProps, type VariantProps } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

export type CardProps = ComponentProps<'div'> &
  VariantProps<'card'> & {
    /** Render the child (e.g. a link) with card styling, making the whole card clickable. */
    asChild?: boolean;
  };

/** Card styled by `components.card` in design.config.ts (props: appearance, padding). */
export function Card({ className, asChild = false, ...props }: CardProps) {
  const [variantAttributes, rest] = splitVariantProps('card', props);
  const Component = asChild ? Slot : 'div';
  return <Component className={cx(componentClass('card'), className)} {...variantAttributes} {...rest} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('card', 'header'), className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cx(componentClass('card', 'title'), className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cx(componentClass('card', 'description'), className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('card', 'content'), className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('card', 'footer'), className)} {...props} />;
}
