import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { AtlasPanel } from './atlas-panel';
import { LectureAtlas } from './lecture-atlas';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
const neet = testExam('neet');

const noPlan = http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } }));
/** v4 chat base of the exam a legacy base belonged to. */
const v4Base = (base: string) => (base.includes('/neet/') ? '/api/v4/chat/competitive/2' : '/api/v4/chat/board/1');
/** The tutor avatar of the dashboard and of any lecture (v4). */
const avatar = (base: string, name: string | null = 'Atlas') => {
  const body = () => HttpResponse.json({ success: true, data: { avatar: name ? [{ id: 1, name, image: null }] : [] } });
  return [http.get(`${API}${v4Base(base)}/dashboard/avatar`, body), http.get(`${API}${v4Base(base)}/lectures/:courseId/avatar`, body)];
};
const emptyHistory = (base: string) => http.get(`${API}${v4Base(base)}/dashboard/chats`, () => HttpResponse.json({ success: true, data: { chats: [] } }));

/** A fake <audio> player: records play/pause and lets a test end playback. */
class FakeAudio {
  static last: FakeAudio | null = null;
  onended: (() => void) | null = null;
  paused = true;
  constructor(public src: string) {
    FakeAudio.last = this;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const panelProps = { expanded: false, onExpand: vi.fn(), onClose: vi.fn() };

beforeEach(() => {
  FakeAudio.last = null;
  vi.stubGlobal('Audio', FakeAudio);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:audio') });
});
afterEach(() => vi.unstubAllGlobals());

describe('AtlasPanel', () => {
  it('shows a break screen when the chat fails to load, and recovers on retry', async () => {
    let calls = 0;
    server.use(
      noPlan,
      ...avatar('/api/v1/chat'),
      http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [{ message_id: 1, text: 'Welcome back', is_student: 0 }] } });
      }),
    );
    renderWithProviders(<AtlasPanel exam={cbse} surface={{ kind: 'dashboard' }} {...panelProps} />);
    expect(screen.getByRole('status', { name: 'Loading chat' })).toBeInTheDocument();
    expect(await screen.findByText('Atlas is taking a short break')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask your Question...' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('renders photos, diagrams, sources and follow-ups, and reads an answer aloud', async () => {
    let spoken: unknown = null;
    server.use(
      noPlan,
      ...avatar('/api/v1/chat'),
      emptyHistory('/api/v1/chat'),
      http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () =>
        HttpResponse.json({
          success: true,
          data: {
            latest_chat: 4,
            conversations: [
              { message_id: 1, text: '', is_student: 1, image: 'https://cdn.test/q.png' },
              {
                message_id: 2,
                text: '<p>Light is <b>reflected</b>.</p>',
                is_student: 0,
                textbook_image: 'https://cdn.test/diagram.png',
                sources: { Book: 'Science', Class: 'Class 10', Chapter: 'Light', Lecture: 'Mirrors' },
              },
            ],
          },
        }),
      ),
      http.post(`${API}/api/v4/chat/board/1/dashboard/messages`, () =>
        HttpResponse.json({ success: true, data: { answer: { text: 'Angle of incidence equals reflection.', followups: ['Show a ray diagram'] } } }),
      ),
      http.post(`${API}/api/v4/chat/speech`, async ({ request }) => {
        spoken = await request.json();
        return HttpResponse.json({ success: true, data: { audio: { audioContent: `data:audio/mpeg;base64,${btoa('mp3')}` } } });
      }),
    );
    renderWithProviders(<AtlasPanel exam={cbse} surface={{ kind: 'dashboard' }} {...panelProps} />);

    const conversation = await screen.findByRole('list', { name: 'Conversation' });
    expect(within(conversation).getByRole('img', { name: 'Your picture' })).toHaveAttribute('src', 'https://cdn.test/q.png');
    expect(within(conversation).getByRole('img', { name: 'Diagram' })).toHaveAttribute('src', 'https://cdn.test/diagram.png');

    const source = within(conversation).getByRole('button', { name: /View source · CBSE textbook/ });
    expect(source).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(source);
    expect(within(conversation).getByText('NCERT Science Class 10')).toBeInTheDocument();
    expect(within(conversation).getByText('Chapter: Light')).toBeInTheDocument();
    expect(within(conversation).getByText('Lecture: Mirrors')).toBeInTheDocument();

    await userEvent.click(within(conversation).getByRole('button', { name: 'Read aloud' }));
    const stop = await within(conversation).findByRole('button', { name: 'Stop reading' });
    expect(spoken).toEqual({ audio_text: 'Light is reflected .', identifier: 'dashboard' });
    expect(FakeAudio.last?.paused).toBe(false);
    await userEvent.click(stop);
    expect(FakeAudio.last?.paused).toBe(true);
    expect(within(conversation).getByRole('button', { name: 'Read aloud' })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Ask your Question...' }), 'Law of reflection?{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Show a ray diagram' }));
    await waitFor(() => expect(screen.getAllByText('Angle of incidence equals reflection.')).toHaveLength(2));
  });

  it('keeps the button usable when read-aloud has no audio', async () => {
    server.use(
      noPlan,
      ...avatar('/api/v1/chat'),
      http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () =>
        HttpResponse.json({ success: true, data: { latest_chat: 4, conversations: [{ message_id: 2, text: 'Hello', is_student: 0 }] } }),
      ),
      http.post(`${API}/api/v4/chat/speech`, () => HttpResponse.json({ success: true, data: {} })),
    );
    renderWithProviders(<AtlasPanel exam={cbse} surface={{ kind: 'dashboard' }} {...panelProps} />);
    const read = await screen.findByRole('button', { name: 'Read aloud' });
    await userEvent.click(read);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Read aloud' })).toBeEnabled());
    expect(FakeAudio.last).toBeNull();
  });

  it('shows competitive sources without the CBSE label, and history beside the chat when expanded', async () => {
    const onExpand = vi.fn();
    let historyCalls = 0;
    server.use(
      noPlan,
      ...avatar('/api/neet/chat'),
      http.get(`${API}/api/v4/chat/competitive/2/dashboard/chats`, () => {
        historyCalls += 1;
        return historyCalls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { chats: [{ chat_id: 4, title: 'Optics', last_message_at: null }] } });
      }),
      http.get(`${API}/api/v4/chat/competitive/2/dashboard/conversation`, () =>
        HttpResponse.json({
          success: true,
          data: { latest_chat: 4, conversations: [{ message_id: 2, text: 'Answer', is_student: 0, sources: { Subject: 'Physics', Book: 'NCERT' } }] },
        }),
      ),
    );
    renderWithProviders(<AtlasPanel exam={neet} surface={{ kind: 'dashboard' }} expanded onExpand={onExpand} onClose={vi.fn()} />);
    const source = await screen.findByRole('button', { name: 'View source' });
    await userEvent.click(source);
    expect(screen.getByText(/Physics • NCERT/)).toBeInTheDocument();

    // expanded: the history sits beside the chat (no drawer), can be retried, and marks the active chat
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Optics/ })).toHaveAttribute('aria-current', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(onExpand).toHaveBeenCalledWith(false);
  });

  it('closes on Escape unless the history drawer is open', async () => {
    const onClose = vi.fn();
    let newChats = 0;
    server.use(
      noPlan,
      ...avatar('/api/v1/chat'),
      emptyHistory('/api/v1/chat'),
      http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [] } })),
      http.post(`${API}/api/v4/chat/board/1/dashboard/chats`, () => {
        newChats += 1;
        return HttpResponse.json({ success: true, data: { latest_chat: 2 } });
      }),
    );
    renderWithProviders(<AtlasPanel exam={cbse} surface={{ kind: 'dashboard' }} expanded={false} onExpand={vi.fn()} onClose={onClose} />);
    await screen.findByText('Ask Atlas anything');

    await userEvent.click(screen.getByRole('button', { name: 'Chat history' }));
    const drawer = await screen.findByRole('dialog', { name: 'Chat history' });
    expect(await within(drawer).findByText('No chats in the last 7 days.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close history' }));
    expect(screen.queryByRole('dialog', { name: 'Chat history' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Chat history' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Chat history' })).getByRole('button', { name: 'New chat' }));
    await waitFor(() => expect(newChats).toBe(1));
    expect(screen.queryByRole('dialog', { name: 'Chat history' })).not.toBeInTheDocument();

    // Without a live-voice provider above it (tests, bare panels) there is no "Live chat" button.
    expect(screen.queryByRole('button', { name: 'Talk live with your tutor' })).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names the lecture tutor from the avatar, or falls back per category', async () => {
    server.use(
      noPlan,
      ...avatar('/api/neet/chat', null),
      ...avatar('/api/v1/chat', null),
      http.get(`${API}/api/v4/chat/competitive/2/lectures/5/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [] } })),
      http.get(`${API}/api/v4/chat/board/1/lectures/5/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [] } })),
    );
    const surface = { kind: 'lecture' as const, courseId: 5, moduleId: null, lectureId: null };
    const { unmount } = renderWithProviders(<AtlasPanel exam={neet} surface={surface} {...panelProps} />);
    expect(await screen.findByText('Ask Prepzy NEET Tutor anything')).toBeInTheDocument();
    expect(screen.getByText('Ask about this lecture')).toBeInTheDocument();
    expect(screen.getByText('Prepzy can make mistakes. Check important answers.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What is photosynthesis?' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<AtlasPanel exam={cbse} surface={surface} {...panelProps} />);
    expect(await screen.findByText('Ask your tutor anything')).toBeInTheDocument();
  });
});

describe('LectureAtlas', () => {
  it('opens from a custom opener and closes back to the launcher', async () => {
    server.use(
      noPlan,
      ...avatar('/api/neet/chat', 'Vedica, Biology tutor'),
      http.get(`${API}/api/v4/chat/competitive/2/lectures/9/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [] } })),
      http.get(`${API}/api/v4/chat/competitive/2/lectures/9/chats`, () => HttpResponse.json({ success: true, data: { chats: [] } })),
    );
    renderWithProviders(
      <LectureAtlas courseId={9} moduleId="" lectureId={null}>
        {(open) => (
          <button type="button" onClick={open}>
            Ask Atlas AI
          </button>
        )}
      </LectureAtlas>,
      { exam: neet },
    );
    expect(await screen.findByRole('button', { name: 'Ask Vedica' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ask Atlas AI' }));
    const panel = await screen.findByRole('dialog', { name: 'Vedica chat' });
    expect(screen.queryByRole('button', { name: 'Ask Vedica' })).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Expand' }));
    expect(within(panel).getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close chat' }));
    expect(screen.queryByRole('dialog', { name: 'Vedica chat' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Vedica' })).toBeInTheDocument();
  });
});
