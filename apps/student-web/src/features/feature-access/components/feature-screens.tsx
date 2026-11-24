'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { featuresForPath, isPageRestricted } from '@/shared/config/feature-routes';
import { routes } from '@/shared/config/routes';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { PageSpinner, StatusScreen } from '@/shared/layout/status-screens';
import { onApiEvent } from '@/shared/lib/api-client';
import { featureAccessKeys, useFeatureAccess, useFeatureRestrictedDialog } from '../hooks';
import { isRestrictableFeature, RESTRICTED_COPY } from '../keys';

/** Full-screen message for a restricted page (opened by URL, or refused by the backend). */
export function FeatureDisabledScreen() {
  const exam = useOptionalExam();
  return (
    <div data-testid="feature-disabled">
      <StatusScreen
        title={RESTRICTED_COPY.screenTitle}
        description={
          <span className="flex flex-col items-center gap-3">
            <span className="bg-brand-75 text-brand flex size-12 items-center justify-center rounded-full">
              <Lock aria-hidden className="size-6" />
            </span>
            {RESTRICTED_COPY.screen}
          </span>
        }
        action={
          <Button asChild>
            <Link href={exam ? routes.dashboard(exam.slug) : '/'}>Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}

/** Inside ExamFrame's access gate: a restricted page's URL shows the disabled screen instead of the page. */
export function FeatureRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const features = featuresForPath(pathname);
  const { isRestricted, isLoading } = useFeatureAccess();
  if (!features) return <>{children}</>;
  // Only a page that may be restricted waits for the access list (no flash of the page, nor of the screen).
  if (isLoading) return <PageSpinner />;
  if (isPageRestricted(features, isRestricted)) return <FeatureDisabledScreen />;
  return <>{children}</>;
}

/**
 * The one "not available" dialog (mounted next to LimitDialog). Locked entry points open it; so does
 * a 403 FEATURE_RESTRICTED from an action (POST, stream…). Page loads that get one (GET) only refresh the access list:
 * their pages show their own state, and a dialog popping up on load would be noise.
 */
export function FeatureRestrictedDialog() {
  const queryClient = useQueryClient();
  const { open, hide, show } = useFeatureRestrictedDialog();

  useEffect(
    () =>
      onApiEvent('featureRestricted', (error, request) => {
        void queryClient.invalidateQueries({ queryKey: featureAccessKeys.all });
        if (request?.method === 'GET') return;
        const feature = (error.details as { feature?: unknown } | undefined)?.feature;
        show(isRestrictableFeature(feature) ? feature : null);
      }),
    [queryClient, show],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && hide()}>
      <DialogContent>
        <DialogTitle>{RESTRICTED_COPY.dialogTitle}</DialogTitle>
        <DialogDescription>{RESTRICTED_COPY.dialog}</DialogDescription>
        <DialogFooter>
          <Button onClick={hide}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
