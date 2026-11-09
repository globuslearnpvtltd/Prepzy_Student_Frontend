import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isYouTubeEnded, VideoPlayer } from './video-player';

const base = { languages: ['english'], language: 'english', onLanguageChange: vi.fn() };

/** Posts a message to the window as if it came from `source` (e.g. the YouTube iframe). */
const postFrom = (source: Window | null, data: unknown) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source }));
  });

describe('isYouTubeEnded', () => {
  it('reads both YouTube end events and ignores everything else', () => {
    expect(isYouTubeEnded('{"event":"onStateChange","info":0}')).toBe(true);
    expect(isYouTubeEnded({ event: 'onStateChange', info: 1 })).toBe(false);
    expect(isYouTubeEnded({ event: 'infoDelivery', info: { playerState: 0 } })).toBe(true);
    expect(isYouTubeEnded({ event: 'infoDelivery', info: null })).toBe(false);
    expect(isYouTubeEnded({ event: 'other' })).toBe(false);
    expect(isYouTubeEnded('not json')).toBe(false);
    expect(isYouTubeEnded(null)).toBe(false);
    expect(isYouTubeEnded(5)).toBe(false);
  });
});

describe('VideoPlayer', () => {
  it('shows the poster, then plays an uploaded video and reports the end only once', async () => {
    const onEnded = vi.fn();
    const { container } = render(<VideoPlayer {...base} url="https://cdn.test/a.mp4" title="Vectors" onEnded={onEnded} />);
    expect(screen.getByRole('heading', { name: 'Vectors' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose language' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', 'https://cdn.test/a.mp4');
    fireEvent.ended(video);
    fireEvent.ended(video);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('embeds YouTube, says it is listening on load and ends on the player’s message', async () => {
    const onEnded = vi.fn();
    render(<VideoPlayer {...base} url="https://youtu.be/abcdef123" title="" onEnded={onEnded} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));

    const frame = screen.getByTitle('Lecture video') as HTMLIFrameElement;
    expect(frame.src).toContain('https://www.youtube.com/embed/abcdef123?autoplay=1&enablejsapi=1');
    const frameWindow = frame.contentWindow!;
    const posted = vi.spyOn(frameWindow, 'postMessage').mockImplementation(() => undefined);
    fireEvent.load(frame);
    expect(posted).toHaveBeenCalledWith(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');

    // messages from other windows, or that aren't an end event, are ignored
    postFrom(window, { event: 'onStateChange', info: 0 });
    postFrom(frameWindow, { event: 'onStateChange', info: 1 });
    expect(onEnded).not.toHaveBeenCalled();
    postFrom(frameWindow, JSON.stringify({ event: 'infoDelivery', info: { playerState: 0 } }));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('uses the latest onEnded callback', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = render(<VideoPlayer {...base} url="https://cdn.test/a.mp4" title="A" onEnded={first} />);
    await userEvent.click(screen.getByRole('button', { name: 'Play video' }));
    rerender(<VideoPlayer {...base} url="https://cdn.test/a.mp4" title="A" onEnded={second} />);
    fireEvent.ended(container.querySelector('video')!);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('switches language from the poster menu, and closes the menu on an outside click', async () => {
    const onLanguageChange = vi.fn();
    render(
      <div>
        <p>outside</p>
        <VideoPlayer url="https://cdn.test/a.mp4" title="A" languages={['english', 'hindi']} language="english" onLanguageChange={onLanguageChange} />
      </div>,
    );
    const toggle = screen.getByRole('button', { name: 'Choose language' });
    expect(toggle).toHaveTextContent('English');
    await userEvent.click(toggle);
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Hindi' }));
    expect(onLanguageChange).toHaveBeenCalledWith('hindi');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
