import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { ExamConfig } from '@/shared/config/exams';
import { ExamProvider } from '@/shared/hooks/use-exam';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

/** Renders with a fresh query cache (and optionally inside an exam route). */
export function renderWithProviders(ui: ReactElement, options: { exam?: ExamConfig } & RenderOptions = {}) {
  const queryClient = createTestQueryClient();
  const { exam, ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    const content = exam ? <ExamProvider value={exam}>{children}</ExamProvider> : children;
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...rest }) };
}
