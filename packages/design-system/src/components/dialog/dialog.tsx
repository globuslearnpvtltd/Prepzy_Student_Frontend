import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import { componentClass } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

/** Accessible modal dialog (focus trap, Esc to close, scroll lock). Styled by `components.dialog`. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  /** Extra classes for the backdrop (e.g. `backdrop-blur-sm` to blur the page behind). */
  overlayClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cx(componentClass('dialog', 'overlay'), overlayClassName)} />
      <DialogPrimitive.Content className={cx(componentClass('dialog', 'content'), className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cx(componentClass('dialog', 'title'), className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cx(componentClass('dialog', 'description'), className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(componentClass('dialog', 'footer'), className)} {...props} />;
}
