import { Button } from '@prepzy/design-system';
import { Construction } from 'lucide-react';
import Link from 'next/link';

/** Stand-in for a section that hasn't been ported yet, so no link in the shell leads to a 404. */
export function SectionPlaceholder({
  title,
  message = 'This section is being moved to the new app.',
  action,
}: {
  title: string;
  message?: string;
  action?: { label: string; href: string };
}) {
  return (
    <section
      aria-labelledby="section-title"
      className="border-line bg-surface mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-xl border-2 px-6 py-12 text-center"
    >
      <span className="bg-brand-75 text-brand flex size-14 items-center justify-center rounded-full">
        <Construction aria-hidden className="size-7" />
      </span>
      <h1 id="section-title" className="text-neutral-850 text-2xl font-semibold">
        {title}
      </h1>
      <p className="text-foreground-muted text-sm">{message}</p>
      {action && (
        <Button asChild className="mt-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </section>
  );
}
