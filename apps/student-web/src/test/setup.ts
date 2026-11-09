import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

// Layout APIs jsdom lacks; ProseMirror (the written-answer editor) calls them on clicks and selection.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
for (const proto of [Element.prototype, Range.prototype] as { getClientRects?: unknown; getBoundingClientRect?: unknown }[]) {
  proto.getClientRects ??= emptyRects;
  proto.getBoundingClientRect ??= zeroRect;
}
document.elementFromPoint ??= () => null;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// Next.js navigation is not available outside the framework; tests read these mocks.
export const navigation = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: '/',
};

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation.searchParams,
  usePathname: () => navigation.pathname,
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/features/auth/device', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDeviceFingerprint: () => Promise.resolve('test-device'),
}));
