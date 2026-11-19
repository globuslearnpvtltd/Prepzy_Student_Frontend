import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { track } from '@/shared/analytics/track';
import { LectureVideoPlayer, type LectureVideoPlayerProps } from './lecture-video-player';
import { CAPTIONS_KEYS, formatTime, LANGUAGE_KEY } from './player-utils';

vi.mock('@/shared/analytics/track', () => ({ track: vi.fn() }));

const FILE = 'https://cdn.test/en.mp4';
const YOUTUBE = 'https://youtu.be/abcdefghijk';
const analytics = { examId: 'cbse', subject: 'Science', chapterName: 'Light', lectureTitle: 'Mirrors' };

type FakeMedia = HTMLVideoElement & { api?: Record<string, ReturnType<typeof vi.fn>>; webkitEnterFullscreen?: () => void };

function renderPlayer(props: Partial<LectureVideoPlayerProps> = {}) {
  const result = render(<LectureVideoPlayer videos={[{ language: 'english', link: FILE }]} title="Mirrors" analytics={analytics} {...props} />);
  return { ...result, media: () => screen.getByTestId('media') as FakeMedia };
}

/** Gives the fake element a clock: `currentTime` is settable, `duration` fixed. */
function clock(media: HTMLMediaElement, duration = 100, start = 0) {
  let time = start;
  Object.defineProperty(media, 'currentTime', { configurable: true, get: () => time, set: (v: number) => (time = v) });
  Object.defineProperty(media, 'duration', { configurable: true, get: () => duration });
  fireEvent.durationChange(media);
  return {
    at(seconds: number) {
      time = seconds;
      fireEvent.timeUpdate(media);
    },
    get time() {
      return time;
    },
  };
}

const desktop = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  localStorage.clear();
  desktop(true);
});

describe('formatTime', () => {
  it('formats minutes and hours, and guards bad input', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-1)).toBe('0:00');
  });
});

describe('LectureVideoPlayer: sources', () => {
  it('plays a YouTube link through its watch URL, with the quality label and captions toggle', () => {
    const { media } = renderPlayer({ videos: [{ language: 'english', link: YOUTUBE }] });
    expect(media()).toHaveAttribute('src', 'https://www.youtube.com/watch?v=abcdefghijk');
    expect(JSON.parse(media().dataset.config!)).toEqual({ youtube: { rel: 0, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 1 } });
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn off captions' })).toHaveAttribute('aria-pressed', 'true');
    // the YouTube poster covers the cued screen; the iframe is cropped until playback settles
    expect(screen.getByTestId('video-layer')).toHaveAttribute('data-cropped', 'true');
    expect(screen.getByRole('status', { name: 'Loading video' })).toBeInTheDocument();
    fireEvent.loadedMetadata(media());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('plays a file URL and builds the HeyGen URL from a bare id (no captions toggle or quality on board files)', () => {
    const { media, rerender } = renderPlayer();
    expect(media()).toHaveAttribute('src', FILE);
    expect(media()).toHaveAttribute('controlslist', 'nodownload');
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /captions/ })).not.toBeInTheDocument();
    rerender(<LectureVideoPlayer videos={[{ language: 'english', link: 'heygen123' }]} />);
    expect(media()).toHaveAttribute('src', 'https://resource2.heygen.ai/video/heygen123/1280x720.mp4');
  });

  it('switches language from the controls and remembers it', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'hindi');
    const videos = [
      { language: 'english', link: FILE },
      { language: 'hindi', link: 'https://cdn.test/hi.mp4' },
      { language: 'hinglish', link: YOUTUBE },
    ];
    const { media } = renderPlayer({ videos });
    expect(media()).toHaveAttribute('src', 'https://cdn.test/hi.mp4');
    const menuButton = screen.getByRole('button', { name: 'Choose language' });
    expect(menuButton).toHaveTextContent('Hindi');
    await userEvent.click(menuButton);
    expect(screen.getByRole('menuitemradio', { name: 'Hindi' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Hinglish' }));
    expect(media()).toHaveAttribute('src', 'https://www.youtube.com/watch?v=abcdefghijk');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('hinglish');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // an outside click closes the menu
    await userEvent.click(menuButton);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('lets the page own the language when it passes onLanguageChange', async () => {
    const onLanguageChange = vi.fn();
    const videos = [
      { language: 'english', link: FILE },
      { language: 'hindi', link: 'https://cdn.test/hi.mp4' },
    ];
    const { media } = renderPlayer({ videos, language: 'hindi', onLanguageChange });
    expect(media()).toHaveAttribute('src', 'https://cdn.test/hi.mp4');
    await userEvent.click(screen.getByRole('button', { name: 'Choose language' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(onLanguageChange).toHaveBeenCalledWith('english');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
  });
});

describe('LectureVideoPlayer: playback', () => {
  it('plays and pauses from the centre button and the control row, and reports it', async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const { media } = renderPlayer({ onPlay, onPause });
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(media().paused).toBe(false);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('video_lecture_started', {
      exam_id: 'cbse',
      video_type: 'lecture',
      subject: 'Science',
      chapter_name: 'Light',
      lecture_title: 'Mirrors',
      class_id: null,
    });
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(media().paused).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(media().paused).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('resets to paused when the browser refuses to play', async () => {
    const { media } = renderPlayer();
    vi.spyOn(media(), 'play').mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(await screen.findByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });

  it('seeks ±10s, shows watched / remaining and the duration pill', async () => {
    const { media } = renderPlayer();
    const time = clock(media(), 1058);
    expect(screen.getByTestId('duration')).toHaveTextContent('17:38');
    expect(screen.getByText('0:00 watched')).toBeInTheDocument();
    expect(screen.getByText('17:38 remaining')).toBeInTheDocument();
    time.at(30);
    await userEvent.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(time.time).toBe(40);
    expect(screen.getByText('0:40 watched')).toBeInTheDocument();
    expect(screen.getByText('16:58 remaining')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    expect(time.time).toBe(0);
    time.at(1055);
    await userEvent.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(time.time).toBe(1058);

    fireEvent.change(screen.getByRole('slider', { name: 'Seek' }), { target: { value: '0.5' } });
    expect(time.time).toBe(529);
  });

  it('sets volume, mutes from the icon and M, and changes speed', async () => {
    const { media } = renderPlayer();
    const volume = screen.getAllByRole('slider', { name: 'Volume' })[0]!;
    fireEvent.change(volume, { target: { value: '0.3' } });
    expect(media()).toHaveAttribute('data-volume', '0.3');
    fireEvent.change(volume, { target: { value: '0' } });
    expect(media().muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
    fireEvent.change(volume, { target: { value: '0.6' } });
    expect(media().muted).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(media().muted).toBe(true);
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(media().muted).toBe(false);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Playback speed' }), '1.5');
    expect(media()).toHaveAttribute('data-rate', '1.5');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['0.5x', '0.75x', '1x', '1.25x', '1.5x', '1.75x', '2x']);
  });

  it('opens a vertical volume slider on phones', async () => {
    desktop(false);
    renderPlayer();
    const mute = screen.getByRole('button', { name: 'Mute' });
    await userEvent.click(mute);
    expect(mute).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('slider', { name: 'Volume' })[1]).toHaveAttribute('aria-orientation', 'vertical');
    fireEvent.mouseDown(document.body);
    expect(mute).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles YouTube captions, remembers the choice and reads the quality YouTube reports', async () => {
    localStorage.setItem(CAPTIONS_KEYS.board, 'off');
    const { media } = renderPlayer({ videos: [{ language: 'english', link: YOUTUBE }] });
    expect(JSON.parse(media().dataset.config!).youtube.cc_load_policy).toBe(0);
    const api = { loadModule: vi.fn(), unloadModule: vi.fn(), getPlaybackQuality: vi.fn(() => 'hd720'), addEventListener: vi.fn() };
    media().api = api;
    clock(media(), 100).at(5);
    expect(screen.getByText('720p')).toBeInTheDocument();

    const cc = screen.getByRole('button', { name: 'Turn on captions' });
    expect(cc).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(cc);
    expect(api.loadModule).toHaveBeenCalledWith('captions');
    expect(localStorage.getItem(CAPTIONS_KEYS.board)).toBe('on');
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(api.unloadModule).toHaveBeenCalledWith('captions');
    expect(localStorage.getItem(CAPTIONS_KEYS.board)).toBe('off');
  });

  it('uncrops YouTube once playback settles with captions on, and shows buffering from the API', () => {
    vi.useFakeTimers();
    try {
      const { media } = renderPlayer({ videos: [{ language: 'english', link: YOUTUBE }] });
      const listeners: ((event: { data: number }) => void)[] = [];
      media().api = { loadModule: vi.fn(), unloadModule: vi.fn(), addEventListener: vi.fn((_: string, fn: (event: { data: number }) => void) => listeners.push(fn)) };
      fireEvent.loadedMetadata(media());
      fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
      expect(screen.getByTestId('video-layer')).toHaveAttribute('data-cropped', 'true');
      act(() => vi.advanceTimersByTime(4500));
      expect(screen.getByTestId('video-layer')).toHaveAttribute('data-cropped', 'false');
      act(() => listeners[0]!({ data: 3 }));
      expect(screen.getByRole('status', { name: 'Loading video' })).toBeInTheDocument();
      expect(screen.getByTestId('video-layer')).toHaveAttribute('data-cropped', 'true');
      act(() => listeners[0]!({ data: 1 }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the controls 3s after the pointer stops while playing', () => {
    vi.useFakeTimers();
    try {
      renderPlayer();
      const controls = screen.getByTestId('controls');
      fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
      fireEvent.pointerMove(screen.getByTestId('lecture-video-player'));
      act(() => vi.advanceTimersByTime(2999));
      expect(controls).toHaveAttribute('data-visible', 'true');
      act(() => vi.advanceTimersByTime(1));
      expect(controls).toHaveAttribute('data-visible', 'false');
      fireEvent.pointerDown(screen.getByTestId('lecture-video-player'));
      expect(controls).toHaveAttribute('data-visible', 'true');
      // paused: always shown
      act(() => vi.advanceTimersByTime(3000));
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      expect(controls).toHaveAttribute('data-visible', 'true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggles fullscreen on the player, or the native video fullscreen on iPhone', async () => {
    const { media } = renderPlayer();
    const wrapper = screen.getByTestId('lecture-video-player');
    const request = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    wrapper.requestFullscreen = request;
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
    expect(request).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: wrapper });
    fireEvent.keyDown(document.body, { key: 'f' });
    expect(exit).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    media().webkitEnterFullscreen = vi.fn();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
    expect(media().webkitEnterFullscreen).toHaveBeenCalledTimes(1);
  });

  it('handles Space / K and the arrow keys, but not while typing, chatting or with modifiers', () => {
    const { media, rerender } = renderPlayer();
    const time = clock(media(), 100, 50);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(media().paused).toBe(false);
    fireEvent.keyDown(document.body, { key: 'k' });
    expect(media().paused).toBe(true);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(time.time).toBe(60);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(time.time).toBe(50);
    fireEvent.keyDown(document.body, { key: 'F', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'x' });

    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: ' ' });
    expect(media().paused).toBe(true);
    input.remove();

    // on the player's own seek slider, arrows are the slider's
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Seek' }), { key: 'ArrowRight' });
    expect(time.time).toBe(50);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Playback speed' }), { key: ' ' });
    expect(media().paused).toBe(true);
    // Space on a focused control still toggles playback
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mute' }), { key: ' ' });
    expect(media().paused).toBe(false);

    rerender(<LectureVideoPlayer videos={[{ language: 'english', link: FILE }]} chatActive />);
    expect(media().paused).toBe(true);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(media().paused).toBe(true);
  });

  it('pauses while the tutor chat or a live call is open', async () => {
    const { media, rerender } = renderPlayer();
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(media().paused).toBe(false);
    rerender(<LectureVideoPlayer videos={[{ language: 'english', link: FILE }]} chatActive />);
    expect(media().paused).toBe(true);
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });

  it('offers a replay at the end', async () => {
    const onEnded = vi.fn();
    const { media } = renderPlayer({ onEnded });
    const time = clock(media(), 100);
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    time.at(100);
    media().pause();
    fireEvent.ended(media());
    expect(onEnded).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Replay video' }));
    expect(time.time).toBe(0);
    expect(media().paused).toBe(false);
  });

  it('sends milestone, completion and exit events', async () => {
    const { media, unmount } = renderPlayer();
    const time = clock(media(), 100);
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    time.at(60);
    expect(track).toHaveBeenCalledWith('video_lecture_milestone', { milestone_percent: 25, lecture_title: 'Mirrors', chapter_name: 'Light', subject: 'Science' });
    expect(track).toHaveBeenCalledWith('video_lecture_milestone', expect.objectContaining({ milestone_percent: 50 }));
    expect(track).not.toHaveBeenCalledWith('video_lecture_milestone', expect.objectContaining({ milestone_percent: 75 }));
    time.at(60);
    expect(vi.mocked(track).mock.calls.filter(([event]) => event === 'video_lecture_milestone')).toHaveLength(2);
    unmount();
    expect(track).toHaveBeenCalledWith('video_lecture_exited', { percent_watched: 60, exam_id: 'cbse', video_type: 'lecture', subject: 'Science', chapter_name: 'Light' });

    vi.mocked(track).mockClear();
    const second = renderPlayer();
    const t2 = clock(second.media(), 100);
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    t2.at(96);
    expect(track).toHaveBeenCalledWith('video_lecture_completed', { exam_id: 'cbse', video_type: 'lecture', subject: 'Science', chapter_name: 'Light', watch_time_seconds: 96 });
    second.unmount();
    expect(track).not.toHaveBeenCalledWith('video_lecture_exited', expect.anything());
  });

  it('sends nothing without analytics props', async () => {
    const { media } = renderPlayer({ analytics: undefined });
    clock(media(), 100);
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(track).not.toHaveBeenCalled();
  });
});

describe('LectureVideoPlayer: errors', () => {
  it('shows "Try again" and asks the page to refresh a broken file link', async () => {
    const onError = vi.fn();
    const { media } = renderPlayer({ onError });
    fireEvent.error(media());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this video right now.");
    // play is unavailable while broken
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(media().paused).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('media')).toBeInTheDocument();
  });

  it('catches a link that failed before the player listened, when play is refused', async () => {
    const onError = vi.fn();
    const { media } = renderPlayer({ onError });
    Object.defineProperty(media(), 'error', { configurable: true, value: { code: 4 } });
    vi.spyOn(media(), 'play').mockRejectedValueOnce(Object.assign(new Error('no source'), { name: 'NotSupportedError' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not refresh links for a YouTube failure', () => {
    const onError = vi.fn();
    const { media } = renderPlayer({ onError, videos: [{ language: 'english', link: YOUTUBE }] });
    fireEvent.error(media());
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('resumes a refreshed link of the same language where the student was', () => {
    const { media, rerender } = renderPlayer();
    clock(media(), 100).at(42);
    rerender(<LectureVideoPlayer videos={[{ language: 'english', link: 'https://cdn.test/fresh.mp4' }]} />);
    const fresh = clock(media(), 100);
    fireEvent.loadedMetadata(media());
    expect(fresh.time).toBe(42);
    // same language: the watched time is kept
    expect(screen.getByText('0:42 watched')).toBeInTheDocument();
  });

  it('renders nothing playable without a link', () => {
    render(<LectureVideoPlayer videos={[{ language: 'english', link: ' ' }]} />);
    expect(screen.queryByTestId('media')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });
});

describe('LectureVideoPlayer: competitive variant', () => {
  it('shows the backdrop, always-on controls, file captions and its own captions key', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <LectureVideoPlayer
          variant="competitive"
          backdrop={<svg data-testid="backdrop" />}
          videos={[{ language: 'hindi', link: FILE }]}
          language="hindi"
          onLanguageChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('backdrop')).toBeInTheDocument();
      // one language: no menu
      expect(screen.queryByRole('button', { name: 'Choose language' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Turn off captions' }));
      expect(localStorage.getItem(CAPTIONS_KEYS.competitive)).toBe('off');
      fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
      fireEvent.pointerMove(screen.getByTestId('lecture-video-player'));
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByTestId('controls')).toHaveAttribute('data-visible', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});
