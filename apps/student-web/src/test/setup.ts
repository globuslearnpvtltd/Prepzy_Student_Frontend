import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetWelcomeVisit } from '@/shared/lib/welcome-visit';
import { server } from './server';

// Layout APIs jsdom lacks; ProseMirror (the written-answer editor) calls them on clicks and selection.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
for (const proto of [Element.prototype, Range.prototype] as { getClientRects?: unknown; getBoundingClientRect?: unknown }[]) {
  proto.getClientRects ??= emptyRects;
  proto.getBoundingClientRect ??= zeroRect;
}
document.elementFromPoint ??= () => null;

// jsdom has no media playback: play() / pause() flip `paused` and fire the events a browser would.
const playingMedia = new WeakSet<HTMLMediaElement>();
Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
  configurable: true,
  get(this: HTMLMediaElement) {
    return !playingMedia.has(this);
  },
});
HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
  if (!playingMedia.has(this)) {
    playingMedia.add(this);
    this.dispatchEvent(new Event('play'));
  }
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
  if (playingMedia.delete(this)) this.dispatchEvent(new Event('pause'));
};
HTMLMediaElement.prototype.load = function load() {};

// react-player renders a plain <video> in tests (the real one lazy-loads YouTube's custom element).
vi.mock('react-player', async () => {
  const { createElement, forwardRef } = await import('react');
  const ReactPlayer = forwardRef<HTMLVideoElement, Record<string, unknown>>(function ReactPlayer(props, ref) {
    const { src, config, volume, playbackRate, width, height, ...rest } = props;
    void width;
    void height;
    return createElement('video', {
      ...rest,
      ref,
      src,
      'data-testid': 'media',
      'data-volume': volume,
      'data-rate': playbackRate,
      'data-config': JSON.stringify(config ?? {}),
    });
  });
  return { default: ReactPlayer };
});

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  sessionStorage.clear();
  // The welcome page's once-per-session decision lives in memory.
  resetWelcomeVisit();
  // Cookies the app sets (e.g. the remembered exam) must not leak into the next test.
  for (const cookie of document.cookie.split('; ').filter(Boolean)) {
    document.cookie = `${cookie.split('=')[0]}=; path=/; max-age=0`;
  }
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
