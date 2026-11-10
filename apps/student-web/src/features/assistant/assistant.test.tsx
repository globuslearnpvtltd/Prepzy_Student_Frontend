import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { atlasEndpoints, imageSrc, toAnswer, toAvatar, toConversation, toHistory, toMessage } from './api';
import { AtlasHost, showsAtlasLauncher } from './components/atlas-host';
import { relativeDay, toChatHtml } from './components/chat-kit';
import { Composer } from './components/composer';
import { LectureAtlas } from './components/lecture-atlas';
import { ReviewChat } from './components/review-chat';
import { openAtlas, useAtlas } from './store';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
const neet = testExam('neet');

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, expiry_date: '2099-01-01', status: 'active' }] },
  }),
);
/** v4 chat base of the exam a legacy base belonged to. */
const v4Base = (base: string) => (base.includes('/neet/') ? '/api/v4/chat/competitive/2' : '/api/v4/chat/board/1');
/** The dashboard tutor avatar (v4). */
const avatar = (base: string) =>
  http.get(`${API}${v4Base(base)}/dashboard/avatar`, () => HttpResponse.json({ success: true, data: { avatar: [{ id: 1, name: 'Atlas', image: null }] } }));

const conversation = {
  success: true,
  data: {
    latest_chat: 7,
    conversations: [
      { message_id: 1, text: 'What is inertia?', is_student: 1 },
      { message_id: 2, text: '<p>Inertia is resistance to change in motion.</p>', is_student: 0 },
    ],
  },
};

beforeEach(() => {
  useAtlas.setState({ open: false, expanded: false, askSheet: false });
  navigation.searchParams = new URLSearchParams();
  navigation.pathname = '/cbse/dashboard';
});

describe('assistant api', () => {
  it('picks the v4 chat routes of the exam, and the lecture endpoints per course', () => {
    expect(atlasEndpoints({ category: 'board', examId: 1 }, { kind: 'dashboard' }).send).toBe('/api/v4/chat/board/1/dashboard/messages');
    expect(atlasEndpoints({ category: 'competitive', examId: 2 }, { kind: 'dashboard' }).history).toBe('/api/v4/chat/competitive/2/dashboard/chats');
    const lecture = atlasEndpoints({ category: 'board', examId: 1 }, { kind: 'lecture', courseId: 5 });
    expect(lecture.conversations).toBe('/api/v4/chat/board/1/lectures/5/conversation');
    expect(lecture.messages(9)).toBe('/api/v4/chat/board/1/lectures/5/chats/9/messages');
    expect(lecture.newChat).toBe('/api/v4/chat/board/1/lectures/5/chats');
    expect(lecture.avatar).toBe('/api/v4/chat/board/1/lectures/5/avatar');
  });

  it('normalises messages, conversations, history, answers and avatars', () => {
    expect(toMessage({ message_id: 3, text: 'Hi', is_student: 1, image: 'abc', sources: { Book: 'Physics', Class: '' } })).toMatchObject({
      id: '3',
      fromStudent: true,
      image: 'data:image/png;base64,abc',
      sources: { book: 'Physics', className: null },
    });
    expect(toMessage({ text: 'x', is_student: false, sources: {} }).sources).toBeNull();
    expect(imageSrc('https://cdn/x.png')).toBe('https://cdn/x.png');
    expect(imageSrc('')).toBeNull();
    expect(toConversation(conversation)).toMatchObject({ chatId: 7, messages: [{ fromStudent: true }, { fromStudent: false }] });
    expect(toConversation(null)).toEqual({ chatId: null, messages: [] });
    expect(toHistory({ data: { chats: [{ chat_id: 4, title: 'Gravity', last_message_at: '2026-01-01' }, { chat_id: 0 }] } })).toEqual([
      { chatId: 4, title: 'Gravity', lastMessageAt: '2026-01-01' },
    ]);
    expect(toAnswer({ success: true, data: { answer: { text: '<p>A</p>', followups: ['Why?', 2] } } })).toMatchObject({
      message: { text: '<p>A</p>', fromStudent: false },
      followups: ['Why?'],
    });
    expect(() => toAnswer({ success: true, data: { answer: { text: '' } } })).toThrow(/couldn't answer/);
    expect(toAvatar({ data: { avatar: [{ name: 'Vedica, Biology tutor', image: 'x.png' }] } })).toEqual({ name: 'Vedica', image: 'x.png' });
    expect(toAvatar({})).toBeNull();
  });

  it('keeps line breaks in plain-text replies and escapes them', () => {
    expect(toChatHtml('a < b\nc')).toBe('a &lt; b<br />c');
    expect(toChatHtml('<p>x</p>')).toBe('<p>x</p>');
    const now = new Date('2026-11-07T12:00:00');
    expect(relativeDay('2026-11-07T08:00:00', now)).toBe('Today');
    expect(relativeDay('2026-11-06T08:00:00', now)).toBe('Yesterday');
    expect(relativeDay('2026-11-03T08:00:00', now)).toBe('4 days ago');
    expect(relativeDay(null, now)).toBe('');
  });

  it('hides the dashboard launcher on chapter pages and the solver', () => {
    expect(showsAtlasLauncher('/cbse/dashboard')).toBe(true);
    expect(showsAtlasLauncher('/cbse/learn/3/4/lecture/9')).toBe(false);
    expect(showsAtlasLauncher('/neet/learn/3/4/video-lectures')).toBe(false);
    expect(showsAtlasLauncher('/neet/doubt-solver')).toBe(false);
  });
});

describe('Atlas on the dashboard', () => {
  it('opens from ?atlas=1, shows the latest chat, sends a question and shows follow-ups', async () => {
    let sent: FormData | null = null;
    server.use(
      plan,
      avatar('/api/v1/chat'),
      http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () => HttpResponse.json(conversation)),
      http.get(`${API}/api/v4/chat/board/1/dashboard/chats`, () => HttpResponse.json({ success: true, data: { chats: [] } })),
      http.post(`${API}/api/v4/chat/board/1/dashboard/messages`, async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json({ success: true, data: { answer: { text: '<p>F equals ma.</p>', followups: ['Give an example'] } } });
      }),
    );
    navigation.searchParams = new URLSearchParams('atlas=1&tab=x');
    renderWithProviders(<AtlasHost />, { exam: cbse });

    const panel = await screen.findByRole('dialog', { name: 'Atlas chat' });
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/dashboard?tab=x', { scroll: false });
    expect(await within(panel).findByText('Inertia is resistance to change in motion.')).toBeInTheDocument();

    await userEvent.type(within(panel).getByRole('textbox', { name: 'Ask your Question...' }), 'Second law?{Enter}');
    expect(await within(panel).findByText('F equals ma.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Give an example' })).toBeInTheDocument();
    expect(sent!.get('text')).toBe('Second law?');
    expect(sent!.get('chat_id')).toBe('7');
    expect(sent!.get('class_id')).toBe('12');

    await userEvent.click(within(panel).getByRole('button', { name: 'Close chat' }));
    expect(screen.queryByRole('dialog', { name: 'Atlas chat' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Atlas' })).toBeInTheDocument();
  });

  it('shows the empty state with suggestions, a failed send, history and new chat (NEET API)', async () => {
    let interactions = 0;
    server.use(
      avatar('/api/neet/chat'),
      http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })),
      http.get(`${API}/api/v4/chat/competitive/2/dashboard/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 3, conversations: [] } })),
      http.get(`${API}/api/v4/chat/competitive/2/dashboard/chats`, () =>
        HttpResponse.json({ success: true, data: { chats: [{ chat_id: 2, title: 'Cell division', last_message_at: null }] } }),
      ),
      http.get(`${API}/api/v4/chat/competitive/2/dashboard/chats/2/messages`, () =>
        HttpResponse.json({ success: true, data: { conversations: [{ message_id: 9, text: 'Mitosis has four phases.', is_student: 0 }] } }),
      ),
      http.post(`${API}/api/v4/chat/competitive/2/dashboard/chats`, () => HttpResponse.json({ success: true, data: { latest_chat: 11 } })),
      http.post(`${API}/api/v4/chat/competitive/2/dashboard/messages`, () => {
        interactions += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );
    renderWithProviders(<AtlasHost />, { exam: neet });
    await userEvent.click(screen.getByRole('button', { name: 'Ask Atlas' }));
    const panel = await screen.findByRole('dialog', { name: 'Atlas chat' });
    await userEvent.click(await within(panel).findByRole('button', { name: 'What is photosynthesis?' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(interactions).toBe(1);

    await userEvent.click(within(panel).getByRole('button', { name: 'Chat history' }));
    const drawer = await screen.findByRole('dialog', { name: 'Chat history' });
    await userEvent.click(await within(drawer).findByRole('button', { name: /Cell division/ }));
    expect(await within(panel).findByText('Mitosis has four phases.')).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'New chat' }));
    expect(await within(panel).findByText('Ask Atlas anything')).toBeInTheDocument();

    expect(within(panel).getByRole('button', { name: 'Talk live with your tutor' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Expand' }));
    expect(useAtlas.getState().expanded).toBe(true);
  });

  it('opens from the mobile Ask sheet: Atlas opens the panel, Socrates opens the solver', async () => {
    server.use(plan, avatar('/api/v1/chat'), http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () => HttpResponse.json(conversation)));
    renderWithProviders(<AtlasHost />, { exam: cbse });
    act(() => useAtlas.getState().setAskSheet(true));
    const sheet = await screen.findByRole('dialog', { name: 'Have a Question/Problem?' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Socrates/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver');

    act(() => useAtlas.getState().setAskSheet(true));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Have a Question/Problem?' })).getByRole('button', { name: /Atlas/ }));
    expect(await screen.findByRole('dialog', { name: 'Atlas chat' })).toBeInTheDocument();
  });

  it('opens on the previous app’s window event and from openAtlas()', async () => {
    server.use(plan, avatar('/api/v1/chat'), http.get(`${API}/api/v4/chat/board/1/dashboard/conversation`, () => HttpResponse.json(conversation)));
    renderWithProviders(<AtlasHost />, { exam: cbse });
    act(() => window.dispatchEvent(new Event('prepzy:open-atlas')));
    expect(await screen.findByRole('dialog', { name: 'Atlas chat' })).toBeInTheDocument();
    act(() => useAtlas.getState().close());
    act(() => openAtlas());
    expect(useAtlas.getState().open).toBe(true);
  });
});

describe('lecture tutor', () => {
  it('uses the course-scoped lecture endpoints and the tutor avatar', async () => {
    let sent: FormData | null = null;
    server.use(
      plan,
      http.get(`${API}/api/v4/chat/board/1/lectures/5/avatar`, () =>
        HttpResponse.json({ success: true, data: { avatar: [{ id: 2, name: 'Vedica', image: null }] } }),
      ),
      http.get(`${API}/api/v4/chat/board/1/lectures/5/conversation`, () => HttpResponse.json({ success: true, data: { latest_chat: 40, conversations: [] } })),
      http.post(`${API}/api/v4/chat/board/1/lectures/5/messages`, async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json({ success: true, data: { answer: { text: 'Look at the graph.' } } });
      }),
    );
    renderWithProviders(<LectureAtlas courseId="5" moduleId="6" lectureId="7" />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Vedica' }));
    const panel = await screen.findByRole('dialog', { name: 'Vedica chat' });
    expect(await within(panel).findByText('Ask Vedica anything')).toBeInTheDocument();
    await userEvent.type(within(panel).getByRole('textbox'), 'Explain slope{Enter}');
    expect(await within(panel).findByText('Look at the graph.')).toBeInTheDocument();
    expect(Object.fromEntries(['module_id', 'lecture_id', 'chat_id', 'avatar'].map((k) => [k, sent!.get(k)]))).toEqual({
      module_id: '6',
      lecture_id: '7',
      chat_id: '40',
      avatar: 'Vedica',
    });
  });
});

const sse = (frames: string[]) =>
  new HttpResponse(
    new ReadableStream({
      start(controller) {
        frames.forEach((f) => controller.enqueue(new TextEncoder().encode(f)));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );

describe('post-submission chat (Discuss with Vedica)', () => {
  const context = { assessmentId: 3, questionId: 8, attemptId: 21, questionText: '<p>Define work.</p>', marksAwarded: 1, totalMarks: 2 };

  it('loads the history and streams the reply (board: form data)', async () => {
    let form: FormData | null = null;
    server.use(
      http.get(`${API}/api/v4/chat/board/1/review/3/8/21/messages`, () =>
        HttpResponse.json({ success: true, data: { conversations: [{ message_id: 1, text: 'Earlier question', is_student: 1 }] } }),
      ),
      http.post(`${API}/api/v4/chat/board/1/review/3/8/21/messages`, async ({ request }) => {
        form = await request.formData();
        return sse(['data: {"token":"Work is "}\n\n', 'data: {"token":"F·d."}\n\ndata: {"followups":["Units?"]}\n\n', 'data: [DONE]\n\n']);
      }),
    );
    renderWithProviders(<ReviewChat context={context} open onClose={() => undefined} />, { exam: cbse });
    expect(await screen.findByText('Earlier question')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'Why did I lose a mark?{Enter}');
    expect(await screen.findByText('Work is F·d.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Units?' })).toBeInTheDocument();
    expect(form!.get('marks_awarded')).toBe('1');
    expect(form!.get('text')).toBe('Why did I lose a mark?');
  });

  it('sends JSON for NEET and shows an error when the stream fails', async () => {
    let body: unknown = null;
    server.use(
      http.get(`${API}/api/v4/chat/competitive/2/review/3/8/21/messages`, () => HttpResponse.json({ success: true, data: { conversations: [] } })),
      http.post(`${API}/api/v4/chat/competitive/2/review/3/8/21/messages`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'down' }, { status: 503 });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ReviewChat context={{ ...context, options: [{ id: 1, text: 'A' }], correctOptionId: 1 }} open onClose={onClose} />, { exam: neet });
    expect(await screen.findByText('Rather talk it through?')).toBeInTheDocument();
    expect(screen.getByText(/Vedica already has your answer and the explanation/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'Explain{Enter}');
    expect(await screen.findByText('Sorry, something went wrong. Please try again.')).toBeInTheDocument();
    expect(body).toMatchObject({ text: 'Explain', correct_option_id: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('composer', () => {
  it('inserts maths symbols, attaches a photo and sends both', async () => {
    const onSend = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    renderWithProviders(<Composer placeholder="Ask" onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask' }), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Math symbols' }));
    await userEvent.click(screen.getByRole('button', { name: '√' }));
    const file = new File(['img'], 'q.png', { type: 'image/png' });
    await userEvent.upload(screen.getByTestId('composer-file'), file);
    expect(screen.getByAltText('Attached photo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('x√', file);
  });

  it('rejects non-images', async () => {
    renderWithProviders(<Composer placeholder="Ask" onSend={() => undefined} />);
    await userEvent.upload(screen.getByTestId('composer-file'), new File(['x'], 'a.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(screen.getByRole('alert')).toHaveTextContent('Please choose an image file.');
  });

  it('records a spoken question and puts the transcript in the box', async () => {
    const stop = vi.fn();
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      stream = { getTracks: () => [{ stop }] };
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['a']) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [{ stop }] })) },
    });
    server.use(http.post(`${API}/api/v4/chat/transcribe`, () => HttpResponse.json({ success: true, message: 'Audio transcribed', data: { text: 'what is torque' } })));
    renderWithProviders(<Composer placeholder="Ask" onSend={() => undefined} allowVoice />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak your question' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('what is torque'));
    vi.unstubAllGlobals();
  });
});
