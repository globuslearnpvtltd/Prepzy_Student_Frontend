import { cx } from '@prepzy/design-system';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

/** The previous profile page's light-blue fields and solid blue buttons. */
export const inputClass = (invalid?: boolean) =>
  cx(
    'bg-info-50/50 h-[46px] w-full rounded-md border-[1.5px] p-3 text-[15px] leading-4 font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-info-400 disabled:cursor-not-allowed',
    invalid ? 'border-danger' : 'border-info-50',
  );

export function ProfileField({
  id,
  label,
  required,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-neutral-550 block text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function SolidButton({ busy, children, className, ...props }: ComponentProps<'button'> & { busy?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        'bg-info-600 border-info-600 text-on-brand flex h-[46px] w-full items-center justify-center gap-2 rounded-md border-[1.5px] text-[16px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60',
        className,
      )}
    >
      {busy ? <Loader2 aria-label="Saving" className="size-5 animate-spin" /> : children}
    </button>
  );
}
