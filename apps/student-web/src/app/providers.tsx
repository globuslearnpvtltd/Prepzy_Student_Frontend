'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { useSessionExpiryRedirect } from '@/features/auth';
import { LimitDialog } from '@/shared/layout/limit-dialog';
import { createQueryClient } from '@/shared/lib/query-client';

const Devtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools))
    : () => null;

function SessionWatcher() {
  useSessionExpiryRedirect();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionWatcher />
      {children}
      <LimitDialog />
      <Toaster position="top-center" richColors closeButton />
      <Devtools />
    </QueryClientProvider>
  );
}
