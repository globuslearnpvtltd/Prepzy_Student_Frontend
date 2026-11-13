import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { assistantApi, chatApiBase, reviewApi, toAnswer, toConversation, toHistory, toMessage, type ReviewContext } from './api';

const cbse = testExam('cbse');
const neet = testExam('neet');
const lecture = { kind: 'lecture', courseId: 5, moduleId: 3, lectureId: 7 } as const;
const dashboard = { kind: 'dashboard' } as const;

const sse = (...frames: object[]) =>
  new HttpResponse(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  });

describe('assistant mapping', () => {
  it('maps messages, sources and student flags', () => {
    const m = toMessage({ message_id: '9', isStudent: 'true', text: 'Hi', image: 'abc', sources: { Book: 'NCERT', Chapter: ' ' } });
    expect(m).toMatchObject({ id: '9', fromStudent: true, text: 'Hi', image: 'data:image/png;base64,abc' });
    expect(m.sources).toEqual({ book: 'NCERT', subject: null, className: null, chapter: null, lecture: null });
    expect(toMessage({ sources: { Book: '' } }).sources).toBeNull();
    expect(toMessage({ updated_at: '2026-01-01' }).createdAt).toBe('2026-01-01');
    expect(toMessage({}).id).toMatch(/^local-/);
  });

  it('reads conversations and drops history rows without an id', () => {
    expect(toConversation({ data: { latest_chat: '4', conversations: [{ text: 'a' }, 'junk'] } })).toMatchObject({
      chatId: 4,
      messages: [{ text: 'a' }],
    });
    expect(toConversation(null)).toEqual({ chatId: null, messages: [] });
    expect(toHistory({ data: { chats: [{ chat_id: 2, title: '' }, { chat_id: 0 }] } })).toEqual([
      { chatId: 2, title: 'Untitled chat', lastMessageAt: null },
    ]);
  });

  it('fails an empty answer and keeps only string follow-ups', () => {
    expect(() => toAnswer({ success: true, data: { answer: { text: ' ' } } })).toThrow(/couldn't answer/);
    const answer = toAnswer({ success: true, data: { answer: { text: 'Yes', followups: ['Why?', 3] } } });
    expect(answer.followups).toEqual(['Why?']);
    expect(answer.message.fromStudent).toBe(false);
    expect(toAnswer({ success: true, data: { answer: { text: 'x', followups: 'no' } } }).followups).toEqual([]);
  });
});

describe('assistantApi requests', () => {
  it('uses the lecture routes and sends every lecture field', async () => {
    const base = `${API}${chatApiBase(cbse)}/lectures/5`;
    let form: FormData | null = null;
    server.use(
      http.get(`${base}/conversation`, () => HttpResponse.json({ data: { latest_chat: 1, conversations: [] } })),
      http.get(`${base}/chats/1/messages`, () => HttpResponse.json({ data: { conversations: [{ text: 'old' }] } })),
      http.get(`${base}/chats`, () => HttpResponse.json({ data: { chats: [{ chat_id: 1, title: 'Optics' }] } })),
      http.post(`${base}/chats`, () => HttpResponse.json({ data: { latest_chat: 8 } })),
      http.get(`${base}/avatar`, () => HttpResponse.json({ data: { avatar: [{ name: 'Atlas, the tutor', image: '/a.png' }] } })),
      http.post(`${base}/messages`, async ({ request }) => {
        form = await request.formData();
        return HttpResponse.json({ success: true, data: { answer: { text: 'Light bends.' } } });
      }),
    );
    expect(await assistantApi.conversation(cbse, lecture)).toEqual({ chatId: 1, messages: [] });
    expect((await assistantApi.messages(cbse, lecture, 1))[0]?.text).toBe('old');
    expect(await assistantApi.history(cbse, lecture)).toEqual([{ chatId: 1, title: 'Optics', lastMessageAt: null }]);
    expect(await assistantApi.newChat(cbse, lecture)).toBe(8);
    expect(await assistantApi.avatar(cbse, lecture)).toEqual({ name: 'Atlas', image: '/a.png' });

    // Photos are left out: jsdom's File can't be sent through Node's fetch.
    const answer = await assistantApi.send(cbse, lecture, {
      text: 'Why?',
      chatId: 1,
      classId: 12,
      className: 'Class 12',
      avatarName: 'Atlas',
    });
    expect(answer.message.text).toBe('Light bends.');
    const sent = Object.fromEntries([...form!.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : (v as File).name]));
    expect(sent).toEqual({
      text: 'Why?',
      class_name: 'Class 12',
      class_id: '12',
      chat_id: '1',
      module_id: '3',
      lecture_id: '7',
      avatar: 'Atlas',
    });
  });

  it('sends only the text on a new dashboard chat', async () => {
    let form: FormData | null = null;
    server.use(
      http.post(`${API}${chatApiBase(neet)}/dashboard/messages`, async ({ request }) => {
        form = await request.formData();
        return HttpResponse.json({ success: true, data: { answer: { text: 'ok' } } });
      }),
    );
    await assistantApi.send(neet, dashboard, { text: 'Hello', chatId: null });
    expect([...form!.keys()]).toEqual(['text']);
  });

  it('decodes read-aloud audio with or without a data-URL prefix', async () => {
    let sent: unknown;
    server.use(
      http.post(`${API}/api/v4/chat/speech`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ data: { audio: { audioContent: `data:audio/mpeg;base64,${btoa('abc')}` } } });
      }),
    );
    const blob = await assistantApi.speech('Read me');
    expect(sent).toEqual({ audio_text: 'Read me', identifier: 'dashboard' });
    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBe(3);
  });
});

describe('reviewApi', () => {
  const ctx: ReviewContext = { assessmentId: 1, questionId: 2, attemptId: 3, subQuestionId: 4, questionText: 'Q?' };

  it('loads history with the sub-question on board and without params on competitive', async () => {
    const urls: string[] = [];
    const reply = ({ request }: { request: Request }) => {
      urls.push(request.url);
      return HttpResponse.json({ data: { conversations: [{ text: 'hi' }] } });
    };
    server.use(
      http.get(`${API}${chatApiBase(cbse)}/review/1/2/3/messages`, reply),
      http.get(`${API}${chatApiBase(neet)}/review/1/2/3/messages`, reply),
    );
    expect((await reviewApi.history(cbse, ctx))[0]?.text).toBe('hi');
    await reviewApi.history(neet, ctx);
    expect(new URL(urls[0]!).searchParams.get('sub_question_id')).toBe('4');
    expect(new URL(urls[1]!).search).toBe('');
  });

  it('streams a competitive reply from a JSON body', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}${chatApiBase(neet)}/review/1/2/3/messages`, async ({ request }) => {
        body = await request.json();
        return sse({ token: 'Mito' }, { token: 'chondria' }, { followups: ['More?'] });
      }),
    );
    const onText = vi.fn();
    const reply = await reviewApi.ask(neet, { ...ctx, options: [{ id: 1, text: 'A' }], correctOptionId: 1 }, 'Why?', onText);
    expect(reply).toEqual({ text: 'Mitochondria', followups: ['More?'] });
    expect(onText).toHaveBeenLastCalledWith('Mitochondria');
    expect(body).toEqual({
      text: 'Why?',
      question: 'Q?',
      question_diagram: '',
      options: [{ id: 1, text: 'A' }],
      correct_option_id: 1,
      selected_option_id: null,
      explanation: '',
    });
  });

  it('streams a board reply from a form', async () => {
    let form: FormData | null = null;
    server.use(
      http.post(`${API}${chatApiBase(cbse)}/review/1/2/3/messages`, async ({ request }) => {
        form = await request.formData();
        return sse({ final: 'Use Ohm’s law.' });
      }),
    );
    const reply = await reviewApi.ask(cbse, { ...ctx, marksAwarded: 2, totalMarks: 5 }, 'Help', () => {});
    expect(reply.text).toBe('Use Ohm’s law.');
    expect(form!.get('sub_question_id')).toBe('4');
    expect(form!.get('marks_awarded')).toBe('2');
    expect(form!.get('total_marks')).toBe('5');
    expect(form!.get('image')).toBeNull();
  });
});
