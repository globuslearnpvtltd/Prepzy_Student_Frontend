import { cx } from '@prepzy/design-system';
import type { ReactNode } from 'react';
import { userMessage } from '@/shared/lib/errors';

/** White card with the previous portal's thin border and small shadow. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('bg-neutral-0 border-schools-line shadow-schools-card rounded-[10px] border', className)}>
      {children}
    </div>
  );
}

/** Small uppercase brand heading used on every card ("STUDENTS", "STUDY ENGAGEMENT" …). */
export function PanelTitle({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' }) {
  return <Tag className="text-brand-700 m-0 p-0 text-[12px] leading-[16px] font-bold">{children}</Tag>;
}

export function LoadError({ error, label }: { error: unknown; label: string }) {
  return (
    <p role="alert" className="text-schools-logout text-[12px]">
      Couldn&apos;t load {label}. {userMessage(error)}
    </p>
  );
}
