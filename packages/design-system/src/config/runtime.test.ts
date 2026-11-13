// @vitest-environment node
import designConfig from '../../design.config.ts';
import { colorValue, type ColorName } from './runtime.ts';

describe('colorValue', () => {
  it('resolves semantic names through palette steps to the raw colour', () => {
    expect(colorValue('brand')).toBe(designConfig.tokens.colors.brand[700]);
    expect(colorValue('brand')).toBe('#3D348B');
    expect(colorValue('danger-strong')).toBe('#B42318');
  });

  it('resolves palette steps', () => {
    expect(colorValue('warning.700')).toBe('#B54708');
    expect(colorValue('account.toast-action')).toBe('#C7BFFB');
  });

  it('throws on an unknown colour', () => {
    expect(() => colorValue('nope.1' as ColorName)).toThrow(/unknown colour/);
  });
});
