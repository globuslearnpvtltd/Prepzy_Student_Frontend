import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Parents', template: '%s · Prepzy Parents' } };

/** Parents portal (parents.prepzy.ai, or /parents on the main host). Session: the `mentorAccessToken` cookie. */
export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface min-h-screen">{children}</div>;
}
