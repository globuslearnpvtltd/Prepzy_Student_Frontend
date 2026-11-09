import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { FakePeerConnection, installVoiceFakes, removeVoiceFakes } from '@/test/fake-webrtc';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { AtlasHost } from './components/atlas-host';
import { LectureAtlas } from './components/lecture-atlas';
import { ReviewChat } from './components/review-chat';
import { useAtlas } from './store';

const cbse = getExam('cbse')!;
const neet = getExam('neet')!;

const plan = http.get(`${API}/api/v1/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, expiry_date: '2099-01-01', status: 'active' }] },
  }),
);
const avatar = (base: string, name = 'Atlas') =>
  http.post(`${API}${base}/marketingChatImageName`, () => HttpResponse.json({ success: true, data: { avatar: [{ id: 1, name, image: 'tutor.png' }] } }));

let starts: { path: string; body: Record<string, unknown> }[];
let saves: { path: string; body: Record<string, unknown> }[];
const voiceBackend = (base: string, kind: string) =>
  server.use(
    http.post(`${API}${base}/${kind}-voice/start`, async ({ request }) => {
      starts.push({ path: new URL(request.url).pathname, body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ success: true, data: { sdp: 'answer-sdp', type: 'answer' } });
    }),
    http.post(`${API}${base}/${kind}-voice/save`, async ({ request }) => {
      saves.push({ path: new URL(request.url).pathname, body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ success: true, data: { chat_id: 7 } });
    }),
  );

const emit = (event: object) => act(() => FakePeerConnection.last!.events.emit(event));

beforeEach(() => {
  installVoiceFakes('granted');
  starts = [];
  saves = [];
  useAtlas.setState({ open: false, expanded: false, askSheet: false });
  navigation.pathname = '/cbse/dashboard';
});
afterEach(() => removeVoiceFakes());

describe('live talk entry points', () => {
  it('Atlas (board dashboard): "Live chat" starts a call with the plan class and the chat so far, then shows the saved talk', async () => {
    let reloads = 0;
    server.use(
      plan,
      avatar('/api/v1/chat'),
      http.get(`${API}/api/v1/chat/dashboard-conversations`, () =>
        HttpResponse.json({ success: true, data: { latest_chat: 7, conversations: [{ message_id: 1, text: '<p>What is inertia?</p>', is_student: 1 }] } }),
      ),
      http.get(`${API}/api/v1/chat/dashboard-chat-history`, () => HttpResponse.json({ success: true, data: { chats: [] } })),
      http.get(`${API}/api/v1/chat/fetch-dashboard-messages/7`, () => {
        reloads += 1;
        return HttpResponse.json({
          success: true,
          data: {
            conversations: [
              { message_id: 1, text: '<p>What is inertia?</p>', is_student: 1 },
              { message_id: 2, text: 'And mass?', is_student: 1 },
              { message_id: 3, text: 'Mass measures inertia.', is_student: 0 },
            ],
          },
        });
      }),
    );
    voiceBackend('/api/v1/chat', 'dashboard');
    renderWithProviders(<AtlasHost />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Ask Atlas' }));
    const panel = await screen.findByRole('dialog', { name: 'Atlas chat' });
    await within(panel).findByText('What is inertia?');
    await userEvent.click(within(panel).getByRole('button', { name: 'Talk live with your tutor' }));

    await screen.findByRole('dialog', { name: 'Live talk with Atlas' });
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({
      path: '/api/v1/chat/dashboard-voice/start',
      body: { class_id: 12, class_name: 'CLASS 12', language: 'english', history: [{ role: 'user', text: 'What is inertia?' }] },
    });
    emit({ type: 'ready' });
    emit({ type: 'user_final', text: 'And mass?' });
    emit({ type: 'bot_end', text: 'Mass measures inertia.' });

    // Closing the chat keeps the call; the floating launcher stays hidden while it runs.
    await userEvent.click(screen.getByRole('button', { name: 'Minimise live talk' }));
    expect(within(panel).getByRole('button', { name: 'Open live talk' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close chat' }));
    expect(screen.queryByRole('button', { name: 'Ask Atlas' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'End live talk' }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]!.body).toMatchObject({ chat_id: 7, class_id: 12 });
    await userEvent.click(screen.getByRole('button', { name: 'Ask Atlas' }));
    const reopened = await screen.findByRole('dialog', { name: 'Atlas chat' });
    await waitFor(() => expect(reloads).toBe(1));
    expect(within(reopened).getByText(/Live talk ended/)).toBeInTheDocument();
    // The reloaded thread already has the talk; it shows once (in the summary card) until the student moves on.
    expect(within(reopened).getAllByText('Mass measures inertia.')).toHaveLength(1);
    // Typing moves on: the card goes and the thread shows the saved turns.
    server.use(
      http.post(`${API}/api/v1/chat/dashboard_chat_interaction`, () =>
        HttpResponse.json({ success: true, data: { answer: { text: 'Sure.', followups: [] } } }),
      ),
    );
    await userEvent.type(within(reopened).getByRole('textbox'), 'Thanks{Enter}');
    expect(await within(reopened).findByText('Sure.')).toBeInTheDocument();
    expect(within(reopened).queryByText(/Live talk ended/)).not.toBeInTheDocument();
    expect(within(reopened).getByText('Mass measures inertia.')).toBeInTheDocument();
  });

  it('Atlas (NEET dashboard) uses the NEET voice endpoint and hangs up on pages with their own tutor', async () => {
    server.use(
      plan,
      avatar('/api/neet/chat'),
      http.get(`${API}/api/neet/chat/dashboard-conversations`, () => HttpResponse.json({ success: true, data: { latest_chat: null, conversations: [] } })),
    );
    voiceBackend('/api/neet/chat', 'dashboard');
    navigation.pathname = '/neet/dashboard';
    const view = renderWithProviders(<AtlasHost />, { exam: neet });
    act(() => useAtlas.getState().openAtlas());
    const panel = await screen.findByRole('dialog', { name: 'Atlas chat' });
    await within(panel).findByText('Ask Atlas anything');
    await userEvent.click(within(panel).getByRole('button', { name: 'Talk live with your tutor' }));
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toEqual({ path: '/api/neet/chat/dashboard-voice/start', body: expect.objectContaining({ class_id: 12 }) });
    expect(starts[0]!.body).not.toHaveProperty('class_name');
    emit({ type: 'ready' });

    navigation.pathname = '/neet/learn/9/10';
    view.rerender(<AtlasHost />);
    await waitFor(() => expect(FakePeerConnection.last!.closed).toBe(true));
  });

  it('lecture chat: board lectures send course + lecture, NEET chapters course + module + class', async () => {
    server.use(
      plan,
      avatar('/api/v1/chat', 'CV Raman, The Physicist'),
      http.get(`${API}/api/v1/chat/lecture-conversations/5`, () => HttpResponse.json({ success: true, data: { latest_chat: 2, conversations: [] } })),
    );
    voiceBackend('/api/v1/chat', 'lecture');
    const board = renderWithProviders(<LectureAtlas courseId={5} moduleId={6} lectureId={50} />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Ask CV Raman' }));
    const panel = await screen.findByRole('dialog', { name: 'CV Raman chat' });
    await within(panel).findByText('Ask CV Raman anything');
    await userEvent.click(within(panel).getByRole('button', { name: 'Talk live with your tutor' }));
    await screen.findByRole('dialog', { name: 'Live talk with CV Raman' });
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({ path: '/api/v1/chat/lecture-voice/start', body: { course_id: 5, lecture_id: 50 } });
    expect(starts[0]!.body).not.toHaveProperty('class_id');
    // Leaving the lecture hangs up.
    board.unmount();
    expect(FakePeerConnection.last!.closed).toBe(true);

    server.use(
      avatar('/api/neet/chat', 'Vedica, Biology tutor'),
      http.get(`${API}/api/neet/chat/lecture-conversations/9`, () => HttpResponse.json({ success: true, data: { latest_chat: 1, conversations: [] } })),
    );
    voiceBackend('/api/neet/chat', 'lecture');
    renderWithProviders(<LectureAtlas courseId={9} moduleId={90} />, { exam: neet });
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Vedica' }));
    const neetPanel = await screen.findByRole('dialog', { name: 'Vedica chat' });
    await within(neetPanel).findByText('Ask Vedica anything');
    await userEvent.click(within(neetPanel).getByRole('button', { name: 'Talk live with your tutor' }));
    await waitFor(() => expect(starts).toHaveLength(2));
    expect(starts[1]).toMatchObject({ path: '/api/neet/chat/lecture-voice/start', body: { course_id: 9, module_id: 90, class_id: 12 } });
  });

  it('Vedica (board result): "Talk live" sends the evaluated question; the ended talk lands in the thread', async () => {
    server.use(http.get(`${API}/api/chat/post-assessment-conversations/3/8/21`, () => HttpResponse.json({ success: true, conversations: [] })));
    voiceBackend('/api/v1/chat', 'post-assessment');
    const context = {
      assessmentId: 3,
      questionId: 8,
      attemptId: 21,
      subQuestionId: 4,
      questionText: '<p>Define <b>work</b>.</p>',
      sampleAnswer: 'W = F·d',
      studentAnswer: 'Force × distance',
      marksAwarded: 1,
      totalMarks: 2,
      feedback: 'Add units',
    };
    renderWithProviders(<ReviewChat context={context} open onClose={() => undefined} />, { exam: cbse });
    expect(await screen.findByText('Rather talk it through?')).toBeInTheDocument();
    expect(screen.getByText(/Vedica already has your answer and marks/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Talk live' }));

    const talk = await screen.findByRole('dialog', { name: 'Live talk with Vedica' });
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({
      path: '/api/v1/chat/post-assessment-voice/start',
      body: {
        question: 'Define work.',
        sample_answer: 'W = F·d',
        student_answer: 'Force × distance',
        marks_awarded: 1,
        total_marks: 2,
        feedback: 'Add units',
        history: [],
      },
    });
    emit({ type: 'ready' });
    expect(within(talk).getByText('“Where did I lose marks?”')).toBeInTheDocument();
    emit({ type: 'user_final', text: 'Where did I lose marks?' });
    emit({ type: 'bot_end', text: 'You missed the units. <solution>W = F·d (J)</solution>' });

    // Minimised, the composer pill shows the running call.
    await userEvent.click(within(talk).getByRole('button', { name: 'Minimise and go back to the chat' }));
    const pill = screen.getAllByRole('button', { name: 'Open live talk with Vedica' }).find((b) => /Live 00:0\d/.test(b.textContent ?? ''));
    expect(pill).toBeDefined();
    const bar = screen.getAllByRole('button', { name: 'Open live talk with Vedica' }).find((b) => /tap to open/.test(b.textContent ?? ''));
    expect(bar).toHaveTextContent('Vedica is explaining');
    await userEvent.click(pill!);
    await userEvent.click(within(talk).getByRole('button', { name: 'End' }));

    expect(await screen.findByText('Where did I lose marks?')).toBeInTheDocument();
    expect(screen.getByText(/Worked solution:/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Live talk ended, 0 s · saved to chat/));
    expect(saves[0]).toMatchObject({ path: '/api/v1/chat/post-assessment-voice/save', body: { assessment_id: 3, question_id: 8, attempt_id: 21, sub_question_id: 4 } });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Live talk ended/)).not.toBeInTheDocument();
  });

  it('Vedica (NEET result) talks about the MCQ; closing the chat hangs up', async () => {
    server.use(http.get(`${API}/api/neet/chat/post-assessment-conversations/3/8/21`, () => HttpResponse.json({ success: true, conversations: [] })));
    voiceBackend('/api/neet/chat', 'post-assessment');
    const onClose = vi.fn();
    const context = {
      assessmentId: 3,
      questionId: 8,
      attemptId: 21,
      questionText: 'Powerhouse of the cell?',
      options: [
        { id: 1, text: 'Nucleus' },
        { id: 2, text: 'Mitochondria' },
      ],
      correctOptionId: 2,
      selectedOptionId: 1,
      feedback: 'Mitochondria make ATP.',
    };
    const view = renderWithProviders(<ReviewChat context={context} open onClose={onClose} />, { exam: neet });
    expect(await screen.findByText(/Vedica already has your answer and the explanation/)).toBeInTheDocument();
    // NEET's text chat takes no photos; the mic is replaced by live talk.
    expect(screen.queryByRole('button', { name: 'Add a photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speak your question' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Talk live with Vedica' }));
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({
      path: '/api/neet/chat/post-assessment-voice/start',
      body: { question: 'Powerhouse of the cell?', options: context.options, correct_option_id: 2, selected_option_id: 1, explanation: 'Mitochondria make ATP.' },
    });
    emit({ type: 'ready' });
    emit({ type: 'user_final', text: 'Why not nucleus?' });
    view.rerender(<ReviewChat context={context} open={false} onClose={onClose} />);
    expect(FakePeerConnection.last!.closed).toBe(true);
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]!.body).toEqual({ chat_id: null, assessment_id: 3, question_id: 8, attempt_id: 21, turns: [{ role: 'user', text: 'Why not nucleus?' }] });
  });
});
