import { BrandPanel } from '@/features/auth/ui';

/** Frame of the sign-in and onboarding pages: brand panel on desktop; each page renders its own AuthScreen. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface grid min-h-dvh lg:h-dvh lg:grid-cols-[41%_1fr] lg:overflow-hidden">
      <BrandPanel />
      <div className="lg:bg-canvas lg:overflow-y-auto">{children}</div>
    </div>
  );
}
