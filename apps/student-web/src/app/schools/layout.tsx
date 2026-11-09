import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Prepzy for Schools', template: '%s · Prepzy for Schools' } };

/** Schools (teacher) portal, served on schools.prepzy.ai (rewritten to /schools/…) or under /schools. */
export default function SchoolsLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-neutral-0 flow-root min-h-dvh">{children}</div>;
}
