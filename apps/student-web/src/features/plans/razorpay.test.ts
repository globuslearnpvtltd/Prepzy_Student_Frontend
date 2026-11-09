import type { RazorpayInstance } from './razorpay';

import type * as RazorpayModule from './razorpay';

type Loader = typeof RazorpayModule;

/** Fresh module per test: the loader caches its in-flight promise. */
async function freshLoader(): Promise<Loader> {
  vi.resetModules();
  return import('./razorpay');
}

const FakeRazorpay = class {
  open() {}
  on() {}
} as unknown as new () => RazorpayInstance;

const injected = () => [...document.querySelectorAll<HTMLScriptElement>('script')].filter((s) => s.src === 'https://checkout.razorpay.com/v1/checkout.js');

describe('loadRazorpay', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'Razorpay');
    injected().forEach((script) => script.remove());
  });

  it('uses the already loaded checkout script', async () => {
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    const { loadRazorpay } = await freshLoader();
    await expect(loadRazorpay()).resolves.toBe(window.Razorpay);
    expect(injected()).toHaveLength(0);
  });

  it('injects the script once and resolves when it loads', async () => {
    const { loadRazorpay, RAZORPAY_SCRIPT } = await freshLoader();
    const first = loadRazorpay();
    const second = loadRazorpay();
    expect(second).toBe(first);
    const scripts = injected();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({ src: RAZORPAY_SCRIPT, async: true });
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    scripts[0]!.onload?.(new Event('load'));
    await expect(first).resolves.toBe(FakeRazorpay);
  });

  it('resolves null when the script loads without the global', async () => {
    const { loadRazorpay } = await freshLoader();
    const pending = loadRazorpay();
    injected()[0]!.onload?.(new Event('load'));
    await expect(pending).resolves.toBeNull();
  });

  it('resolves null on a load error and tries again on the next call', async () => {
    const { loadRazorpay } = await freshLoader();
    const failed = loadRazorpay();
    const [script] = injected();
    script!.onerror?.(new Event('error'));
    await expect(failed).resolves.toBeNull();

    const retry = loadRazorpay();
    expect(retry).not.toBe(failed);
    const scripts = injected();
    expect(scripts).toHaveLength(2);
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    scripts[1]!.onload?.(new Event('load'));
    await expect(retry).resolves.toBe(FakeRazorpay);
  });
});
