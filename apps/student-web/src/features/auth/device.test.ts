// The global setup stubs getDeviceFingerprint; these tests load the real module.
import type * as Device from './device';

type DeviceModule = typeof Device;

async function loadDevice(fingerprint: () => Promise<{ visitorId: string }>): Promise<DeviceModule> {
  vi.resetModules();
  vi.doMock('@fingerprintjs/fingerprintjs', () => ({ load: () => Promise.resolve({ get: fingerprint }) }));
  return vi.importActual<DeviceModule>('./device');
}

afterEach(() => vi.doUnmock('@fingerprintjs/fingerprintjs'));

describe('getDeviceFingerprint', () => {
  it('returns the FingerprintJS visitor id and computes it only once', async () => {
    const get = vi.fn(() => Promise.resolve({ visitorId: 'visitor-1' }));
    const device = await loadDevice(get);
    expect(await device.getDeviceFingerprint()).toBe('visitor-1');
    expect(await device.getDeviceFingerprint()).toBe('visitor-1');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to "unknown" when fingerprinting fails (e.g. blocked by an extension)', async () => {
    const device = await loadDevice(() => Promise.reject(new Error('blocked')));
    expect(await device.getDeviceFingerprint()).toBe('unknown');
  });
});

describe('exam cookie', () => {
  it('remembers and forgets the current exam', async () => {
    const device = await vi.importActual<DeviceModule>('./device');
    device.rememberExam('neet');
    expect(document.cookie).toContain('prepzy_exam=neet');
    device.forgetExam();
    expect(document.cookie).not.toContain('prepzy_exam=neet');
  });
});
