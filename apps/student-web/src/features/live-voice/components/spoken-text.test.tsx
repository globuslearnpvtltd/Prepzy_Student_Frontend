import { act, render, screen } from '@testing-library/react';
import type { LiveVoice } from '../provider';
import { SpokenText, timedPosition } from './spoken-text';

// The highlight is driven by the live call's audio meters; the tests drive those directly.
let voice: Partial<LiveVoice> | null = null;
vi.mock('../provider', () => ({ useLiveVoice: () => voice }));

type Meters = LiveVoice['meters'];
const makeMeters = (): Meters => ({ levels: { mic: 0, bot: 0 }, wordTiming: { replyId: 0, anchors: [] } });

// "Hello"=7, "there,"=11 (→18, clause), "friend."=16 (→34, sentence), "Next"=6 (→40), "sentence"=10 (→50), "here."=14 (→64)
const TEXT = 'Hello there, friend. Next sentence here.';

const states = () => screen.getAllByText(/\S/, { selector: 'span[data-state]' }).map((el) => el.getAttribute('data-state'));
const nowWord = () => document.querySelector('[data-state="now"]')?.textContent ?? null;

/** Ticks the 50 ms timer for `ms` with the tutor audible (level) or silent. */
function play(meters: Meters, ms: number, level: number) {
  meters.levels.bot = level;
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  voice = null;
});

describe('SpokenText', () => {
  it('renders the words with the first one current when there is no call', () => {
    render(<SpokenText replyId={1} text={`${TEXT} <solution>x = 1</solution>`} />);
    expect(states()).toEqual(['now', 'next', 'next', 'next', 'next', 'next']);
    expect(screen.queryByText(/x = 1/)).not.toBeInTheDocument();
  });

  it('moves the highlight while she speaks and holds at the end of a sentence until she pauses', () => {
    const meters = makeMeters();
    voice = { meters, language: 'english', tutorPaused: false, screenOpen: false };
    render(<SpokenText replyId={2} text={TEXT} />);
    expect(nowWord()).toBe('Hello');

    play(meters, 1000, 0.5); // ~17 units at the starting English speed
    expect(nowWord()).toBe('there,');

    play(meters, 1500, 0.5); // held at the end of "friend." (the next word shows as current)
    expect(nowWord()).toBe('Next');
    play(meters, 1000, 0.5);
    expect(nowWord()).toBe('Next');

    play(meters, 1500, 0.5); // still talking after the hold: move on through the next sentence
    expect(nowWord()).toBe('here.');
  });

  it('holds while the tutor is paused', () => {
    const meters = makeMeters();
    voice = { meters, language: 'hindi', tutorPaused: true, screenOpen: false };
    render(<SpokenText replyId={3} text={TEXT} />);
    play(meters, 2000, 0.5);
    expect(nowWord()).toBe('Hello');
  });

  it('snaps to the pause that fits when her voice stops, then reads to the end once all text is in', () => {
    const meters = makeMeters();
    voice = { meters, language: 'hinglish', tutorPaused: false, screenOpen: false };
    const { rerender } = render(<SpokenText replyId={4} text={TEXT} />);
    play(meters, 1000, 0.5);
    play(meters, 400, 0); // a real pause: re-sync to the comma after "there,"
    expect(nowWord()).toBe('friend.');
    expect(states().slice(0, 2)).toEqual(['past', 'past']);

    rerender(<SpokenText replyId={4} text={TEXT} done />);
    play(meters, 3000, 0.5);
    play(meters, 2500, 0); // long silence after the last word: finished
    expect(states().every((s) => s === 'past')).toBe(true);

    // A new answer starts again from the first word.
    rerender(<SpokenText replyId={5} text="Another answer." />);
    expect(nowWord()).toBe('Another');
  });

  it('snaps to a near pause after a short stretch and skips pause points too far ahead', () => {
    const meters = makeMeters();
    voice = { meters, language: 'english', tutorPaused: false, screenOpen: false };
    render(<SpokenText replyId={6} text="One, two three four five six seven eight nine ten eleven twelve thirteen." />);
    play(meters, 600, 0); // the hangover counts as a little speech, then the pause snaps to "One,"
    expect(nowWord()).toBe('two');
    play(meters, 100, 0.5);
    play(meters, 500, 0); // the only pause left is far ahead: stay
    expect(nowWord()).toBe('two');
  });

  it("follows the service's word timings for the current reply", () => {
    const meters = makeMeters();
    meters.wordTiming = { replyId: 7, anchors: [{ index: 0, ms: 0 }, { index: 3, ms: 600 }] };
    voice = { meters, language: 'english', tutorPaused: false, screenOpen: false };
    render(<SpokenText replyId={7} text={TEXT} />);
    play(meters, 700, 0.5);
    // Past the last anchor (word 3) it keeps going at the measured speed.
    expect(nowWord()).toBe('Next');
  });

  it('highlights a formula as one word', () => {
    const meters = makeMeters();
    voice = { meters, language: 'english', tutorPaused: false, screenOpen: false };
    render(<SpokenText replyId={8} text={'So \\[E = mc^2\\] holds.'} />);
    expect(document.querySelectorAll('span[data-state]')).toHaveLength(3);
    play(meters, 500, 0.5);
    expect(document.querySelectorAll('[data-state="past"]')).toHaveLength(1);
  });

  describe('keeps the current word in view', () => {
    let restore: () => void;
    beforeEach(() => {
      const proto = HTMLElement.prototype;
      const original = Object.getOwnPropertyDescriptor(proto, 'offsetParent');
      Object.defineProperty(proto, 'offsetParent', { configurable: true, get: () => document.body });
      restore = () => (original ? Object.defineProperty(proto, 'offsetParent', original) : undefined);
    });
    afterEach(() => restore());

    it('scrolls the page to the word when there is no scroll box', () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      voice = { meters: makeMeters(), language: 'english', screenOpen: true };
      render(<SpokenText replyId={9} text={TEXT} />);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
    });

    it('scrolls its box only when the word leaves the upper part', () => {
      const meters = makeMeters();
      voice = { meters, language: 'english', tutorPaused: false, screenOpen: false };
      const scrollTo = vi.fn();
      const { container } = render(
        <div data-spoken-scroll>
          <SpokenText replyId={10} text={TEXT} />
        </div>,
      );
      const box = container.firstElementChild as HTMLElement;
      box.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
      Object.defineProperty(box, 'clientHeight', { value: 100 });
      box.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
      let wordTop = 10;
      vi.spyOn(HTMLSpanElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: wordTop }) as DOMRect);

      play(meters, 1000, 0.5); // next word, still in the upper part
      expect(scrollTo).not.toHaveBeenCalled();
      wordTop = 90;
      play(meters, 1000, 0.5);
      expect(scrollTo).toHaveBeenCalledWith({ top: 65, behavior: 'smooth' });
    });
  });
});

describe('timedPosition', () => {
  const layout = { ends: [10, 20, 30, 40], pauses: [{ at: 20, sentence: true }], total: 40 };

  it('returns null without timings or words', () => {
    expect(timedPosition([], 100, layout, 10)).toBeNull();
    expect(timedPosition([{ index: 0, ms: 0 }], 100, { ends: [], pauses: [], total: 0 }, 10)).toBeNull();
  });

  it('is 0 before the first anchor and interpolates between anchors', () => {
    expect(timedPosition([{ index: 1, ms: 500 }], 100, layout, 10)).toBe(0);
    expect(timedPosition([{ index: 0, ms: 0 }, { index: 2, ms: 1000 }], 500, layout, 10)).toBe(10);
  });

  it('runs on past the last anchor at the measured or fallback speed, capped at the next sentence end', () => {
    // Measured: 20 units in 1 s; 0.25 s past word 2's anchor → 20 + 5, capped at total.
    expect(timedPosition([{ index: 0, ms: 0 }, { index: 2, ms: 1000 }], 1250, layout, 10)).toBe(25);
    // One anchor: fallback speed 8/s, capped at the sentence end at 20.
    expect(timedPosition([{ index: 1, ms: 0 }], 5000, layout, 8)).toBe(20);
    // Same anchor time twice: no speed measured, fallback used.
    expect(timedPosition([{ index: 0, ms: 0 }, { index: 1, ms: 0 }], 500, layout, 4)).toBe(12);
  });
});
