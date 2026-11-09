import { SchoolsHeader } from '@/features/schools/ui';

/** Signed-in schools pages: sticky header with the Dashboard tab and the teacher menu. */
export default function SchoolsPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SchoolsHeader />
      {children}
    </>
  );
}
