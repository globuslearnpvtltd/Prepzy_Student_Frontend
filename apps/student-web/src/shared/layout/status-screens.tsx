import { Button, Spinner } from '@prepzy/design-system';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Centred full-area message used for errors, empty states and access screens. */
export function StatusScreen({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="text-foreground-muted text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}

export function HomeLink({ href = '/', children = 'Go home' }: { href?: string; children?: ReactNode }) {
  return (
    <Button asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
