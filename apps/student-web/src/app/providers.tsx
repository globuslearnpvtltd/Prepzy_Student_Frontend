'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { SessionExpiredDialog } from '@/features/auth/ui';
import { LimitDialog } from '@/shared/layout/limit-dialog';
import { createQueryClient } from '@/shared/lib/query-client';

const Devtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools))
    : () => null;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <LimitDialog />
      <SessionExpiredDialog />
      {/* Every toast is the app's own (shared/ui/toast `notify`): it sets its position and Close button. */}
      <Toaster />
      <Devtools />
    </QueryClientProvider>
  );
}
