import { act, render } from '@testing-library/react';
import { LiveVoiceProvider, useLiveVoice, type LiveVoice } from './provider';
import { LANGUAGE_STORAGE_KEY } from './store';
import type { VoiceConfig } from './types';

const CONFIG: VoiceConfig = { variant: 'dashboard', exam: { category: 'board', examId: 1 }, classId: 10 };

function mount() {
  const ref: { current: LiveVoice | null } = { current: null };
  function Probe() {
    ref.current = useLiveVoice();
    return null;
  }
  render(
    <LiveVoiceProvider config={CONFIG}>
      <Probe />
    </LiveVoiceProvider>,
  );
  return ref;
}

describe('LiveVoiceProvider before a call starts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is null outside a provider', () => {
    let value: LiveVoice | null | undefined;
    function Probe() {
      value = useLiveVoice();
      return null;
    }
    render(<Probe />);
    expect(value).toBeNull();
  });

  it('restores the saved language, ignores unknown ones, and saves a new choice', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'hindi');
    const voice = mount();
    expect(voice.current!.language).toBe('hindi');
    expect(voice.current!.isActive).toBe(false);
    expect(voice.current!.variant).toBe('dashboard');

    act(() => voice.current!.setLanguage('hinglish'));
    expect(voice.current!.language).toBe('hinglish');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hinglish');

    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'french');
    expect(mount().current!.language).not.toBe('french');
  });

  it('works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const voice = mount();
    act(() => voice.current!.setLanguage('hindi'));
    expect(voice.current!.language).toBe('hindi');
  });

  it('clears the last summary and ignores controls while there is no engine', () => {
    const voice = mount();
    act(() => voice.current!.dismissSummary());
    expect(voice.current!.lastSession).toBeNull();
    expect(() => {
      voice.current!.end();
      voice.current!.toggleMute();
      voice.current!.openScreen();
    }).not.toThrow();
  });
});
