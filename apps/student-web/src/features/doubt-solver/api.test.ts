import { http, HttpResponse } from 'msw';
import { LEARN_API, learnApiBase } from '@/shared/config/exams';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { doubtsApiBase, parseStoredImages, removeLatexTables, solverApi, toBankQuestions, toTutorReply } from './api';

const cbse = testExam('cbse');
const neet = testExam('neet');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const physics = { id: 3, title: 'PHYSICS' };

describe('doubt solver mapping edge cases', () => {
  it('reads question levels, labels and stored images', () => {
    const [a, b] = toBankQuestions({
      data: { questions: [{ id: 1, question_level: 2, set_name: 'Set A', year: 2024 }, { id: 2, difficulty_level: 'hard', marks: '' }] },
    });
    expect(a).toMatchObject({ level: 'Medium', label: 'Set A · 2024', marks: null });
    expect(b).toMatchObject({ level: 'Hard', label: null });
    expect(parseStoredImages('[broken')).toEqual([]);
    expect(parseStoredImages('{"a":1}')).toEqual(['{"a":1}']);
    expect(parseStoredImages('["u", 3, ""]')).toEqual(['u']);
    expect(removeLatexTables('a \\begin{tabular}{c} x')).toBe('a');
  });

  it('fails an empty tutor reply', () => {
    expect(() => toTutorReply({ text: ' ' })).toThrow(/couldn't reply/);
  });
});

describe('solverApi requests', () => {
  it('asks for the class textbooks on board and all textbooks on competitive', async () => {
    const urls: URL[] = [];
    const books = ({ request }: { request: Request }) => {
      urls.push(new URL(request.url));
      return ok({ subject_courses: [{ subject_id: 1, subject_name: 'Hindi', textbooks: [{ id: 9 }] }] });
    };
    server.use(http.get(`${API}${learnApiBase(cbse)}/textbooks`, books), http.get(`${API}${learnApiBase(neet)}/textbooks`, books));
    expect(await solverApi.books(cbse, 12)).toEqual([]); // Hindi isn't solvable on board
    expect(await solverApi.books(neet, null)).toHaveLength(1);
    expect(urls[0]!.searchParams.get('class_id')).toBe('12');
    expect(urls[1]!.search).toBe('');
  });

  it('picks the question bank route by tab and exam category', async () => {
    const hits: string[] = [];
    const bank = ({ request }: { request: Request }) => {
      hits.push(new URL(request.url).pathname);
      return ok({ questions: [{ id: 1 }] });
    };
    server.use(
      http.get(`${API}${LEARN_API}/modules/7/pyqs`, bank),
      http.get(`${API}${LEARN_API}/modules/7/ncert-questions`, bank),
      http.get(`${API}${learnApiBase(neet)}/chapters/7/questions`, bank),
      http.get(`${API}${LEARN_API}/courses/9/outline`, () => ok({ finalList: [{ category: 'module', id: 7, module_order: 1 }] })),
    );
    await solverApi.bankQuestions(cbse, 7, 'pyq');
    await solverApi.bankQuestions(cbse, 7, 'end');
    await solverApi.bankQuestions(neet, 7, 'end');
    expect(hits).toEqual([`${LEARN_API}/modules/7/pyqs`, `${LEARN_API}/modules/7/ncert-questions`, `${learnApiBase(neet)}/chapters/7/questions`]);
    expect(await solverApi.chapters(9)).toEqual([{ id: 7, title: 'Chapter', order: 1 }]);
  });

  it('checks a question, opens a chat and fails without a chat id', async () => {
    const bodies: unknown[] = [];
    let chatId: unknown = 44;
    server.use(
      http.post(`${API}${doubtsApiBase(cbse)}/check`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({ valid: true });
      }),
      http.post(`${API}${doubtsApiBase(cbse)}/chats`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({ chat_id: chatId });
      }),
    );
    expect(await solverApi.checkQuestion(cbse, null, 'What is force?')).toBe(true);
    expect(await solverApi.createChat(cbse, { subjectId: 3, classId: 12 })).toBe(44);
    expect(bodies).toEqual([{ query: 'What is force?', sub_name: '' }, { subject_id: 3, class_id: 12 }]);
    chatId = null;
    await expect(solverApi.createChat(cbse, { subjectId: null, classId: null })).rejects.toMatchObject({ code: 'NO_CHAT' });
  });

  it('sends the tutor form for a turn and for concept cards', async () => {
    const forms: FormData[] = [];
    server.use(
      http.post(`${API}${doubtsApiBase(neet)}/chats/44/ask`, async ({ request }) => {
        forms.push(await request.formData());
        return ok({ chat_id: 44, text: 'Step 1', current_card_no: '2', reached_final_solution: true });
      }),
      http.post(`${API}${doubtsApiBase(neet)}/chats/44/concept-cards`, async ({ request }) => {
        forms.push(await request.formData());
        return ok({ concept_cards: [{ card_no: 1, title: 'Force' }], sources: { Book: 'NCERT' } });
      }),
    );
    const request = { chatId: 44, text: 'Help', className: null, subject: physics, imageUrls: ['u1'], attachedImageUrls: ['u2'] };
    expect(await solverApi.ask(neet, request)).toMatchObject({ text: 'Step 1', cardNo: 2, solved: true, isFirst: false });
    const cards = await solverApi.conceptCards(neet, { ...request, subject: null });
    expect(cards.cards[0]!.title).toBe('Force');
    expect(cards.sources?.book).toBe('NCERT');
    expect(Object.fromEntries(forms[0]!.entries())).toEqual({
      text: 'Help',
      class_name: '',
      sub_name: 'PHYSICS',
      image_url: 'u1',
      attached_image_url: 'u2',
    });
    expect(forms[1]!.get('sub_name')).toBe('');
  });

  it('loads messages and the class history', async () => {
    let classId: string | null = null;
    server.use(
      http.get(`${API}${doubtsApiBase(cbse)}/chats/44/messages`, () => ok({ conversations: [{ message_id: 1, is_student: 1, text: 'Q' }] })),
      http.get(`${API}${doubtsApiBase(cbse)}/chats`, ({ request }) => {
        classId = new URL(request.url).searchParams.get('class_id');
        return ok({ chats: [{ chat_id: 44 }] });
      }),
    );
    expect(await solverApi.messages(cbse, 44)).toEqual([{ id: '1', fromStudent: true, text: 'Q', images: [] }]);
    expect((await solverApi.history(cbse, 12))[0]).toMatchObject({ chatId: 44, title: 'Untitled doubt', firstMessage: '' });
    expect(classId).toBe('12');
  });
});
