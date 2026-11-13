import { http, HttpResponse } from 'msw';
import { ApiError } from '@/shared/lib/errors';
import { API, server } from '@/test/server';
import {
  CONNECTION_LOST,
  HISTORY_LIMIT,
  liveVoiceApi,
  micErrorInfo,
  saveScope,
  startErrorInfo,
  startScope,
  toHistory,
  voiceEndpoints,
} from './api';
import type { VoiceConfig, VoiceTurn } from './types';

const BOARD = { category: 'board', examId: 1 } as const;
const NEET = { category: 'competitive', examId: 2 } as const;

const lecture: VoiceConfig = { variant: 'lecture', exam: BOARD, courseId: 7, lectureId: 70 };
const neetLecture: VoiceConfig = { variant: 'neet-lecture', exam: NEET, courseId: 8, moduleId: 80, classId: 12 };
const dashboard: VoiceConfig = { variant: 'dashboard', exam: BOARD, classId: 10, className: 'Class 10' };
const neetDashboard: VoiceConfig = { variant: 'neet-dashboard', exam: NEET };
const boardReview: VoiceConfig = {
  variant: 'post-assessment',
  exam: BOARD,
  postAssessment: {
    assessment_id: 3,
    question_id: 8,
    attempt_id: 21,
    question: 'Define work.',
    question_diagram: '',
    sample_answer: 'Work = F·d',
    sample_diagram: '',
    student_answer: 'Force times distance',
    student_diagram: '',
    marks_awarded: 1,
    total_marks: 2,
    feedback: 'Units missing',
  },
};
const neetReview: VoiceConfig = {
  variant: 'neet-post-assessment',
  exam: NEET,
  postAssessment: {
    assessment_id: 4,
    question_id: 9,
    attempt_id: 22,
    question: 'Which organelle makes ATP?',
    question_diagram: '',
    options: [{ id: 1, text: 'Mitochondria' }],
    correct_option_id: 1,
    selected_option_id: 1,
    explanation: 'Powerhouse.',
  },
};

describe('voice routes and request scopes', () => {
  it('builds the v4 start / save routes for every surface', () => {
    expect(voiceEndpoints(lecture)).toEqual({
      start: '/api/v4/chat/board/1/voice/lectures/7/start',
      save: '/api/v4/chat/board/1/voice/lectures/7/save',
    });
    expect(voiceEndpoints(neetDashboard).start).toBe('/api/v4/chat/competitive/2/voice/dashboard/start');
    expect(voiceEndpoints(boardReview).save).toBe('/api/v4/chat/board/1/voice/review/3/8/21/save');
  });

  it('sends each tutor the context it needs', () => {
    expect(startScope(lecture)).toEqual({ course_id: 7, lecture_id: 70 });
    expect(startScope(neetLecture)).toEqual({ course_id: 8, module_id: 80, class_id: 12 });
    expect(startScope(dashboard)).toEqual({ class_id: 10, class_name: 'Class 10' });
    expect(startScope({ ...dashboard, classId: null, className: null })).toEqual({});
    expect(startScope(neetDashboard)).toEqual({});
    expect(startScope(boardReview)).toMatchObject({ question: 'Define work.', feedback: 'Units missing', total_marks: 2 });
    expect(startScope(boardReview)).not.toHaveProperty('assessment_id');
    expect(startScope(neetReview)).toMatchObject({ options: [{ id: 1, text: 'Mitochondria' }], correct_option_id: 1 });
    expect(startScope({ variant: 'post-assessment', exam: BOARD })).toEqual({});
  });

  it('saves under the right ids', () => {
    expect(saveScope(lecture)).toEqual({ course_id: 7 });
    expect(saveScope(dashboard)).toEqual({ class_id: 10 });
    expect(saveScope(neetDashboard)).toEqual({ class_id: null });
    expect(saveScope(neetReview)).toEqual({ assessment_id: 4, question_id: 9, attempt_id: 22 });
    expect(saveScope({ ...boardReview, postAssessment: { ...boardReview.postAssessment!, sub_question_id: 5 } })).toEqual({
      assessment_id: 3,
      question_id: 8,
      attempt_id: 21,
      sub_question_id: 5,
    });
  });

  it('keeps only the newest non-empty turns as history', () => {
    const turns: VoiceTurn[] = [
      { role: 'user', text: '   ' },
      ...Array.from({ length: HISTORY_LIMIT + 2 }, (_, i) => ({ role: 'assistant' as const, text: `t${i}`, image: 'x.png' })),
    ];
    const history = toHistory(turns);
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0]).toEqual({ role: 'assistant', text: 't2' });
    expect(history.at(-1)).toEqual({ role: 'assistant', text: `t${HISTORY_LIMIT + 1}` });
  });
});

describe('liveVoiceApi', () => {
  it('posts the offer with scope, language and history, and returns the answer', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/api/v4/chat/board/1/voice/lectures/7/start`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { sdp: 'answer-sdp', type: 'pranswer' } });
      }),
    );
    const answer = await liveVoiceApi.start(lecture, {
      offer: { sdp: 'offer-sdp', type: 'offer' },
      language: 'hindi',
      history: [{ role: 'user', text: 'Hi' }],
    });
    expect(answer).toEqual({ sdp: 'answer-sdp', type: 'pranswer' });
    expect(body).toEqual({
      sdp: 'offer-sdp',
      type: 'offer',
      course_id: 7,
      lecture_id: 70,
      language: 'hindi',
      history: [{ role: 'user', text: 'Hi' }],
    });
  });

  it('defaults the answer type and fails when the service sends no SDP', async () => {
    server.use(
      http.post(`${API}/api/v4/chat/board/1/voice/dashboard/start`, () =>
        HttpResponse.json({ success: true, data: { sdp: 'a' } }),
      ),
      http.post(`${API}/api/v4/chat/competitive/2/voice/dashboard/start`, () => HttpResponse.json({ success: true, data: null })),
    );
    const input = { offer: { sdp: 'o', type: 'offer' }, language: 'english' as const, history: [] };
    await expect(liveVoiceApi.start(dashboard, input)).resolves.toEqual({ sdp: 'a', type: 'answer' });
    await expect(liveVoiceApi.start(neetDashboard, input)).rejects.toMatchObject({ status: 502, code: 'NO_ANSWER' });
  });

  it('saves the transcript and returns the chat id (null when missing)', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/api/v4/chat/board/1/voice/lectures/7/save`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { chat_id: 41 } });
      }),
      http.post(`${API}/api/v4/chat/board/1/voice/dashboard/save`, () => HttpResponse.json({ success: true, data: {} })),
    );
    const id = await liveVoiceApi.save(lecture, null, [{ role: 'assistant', text: 'Light is a wave', image: undefined }]);
    expect(id).toBe(41);
    expect(body).toEqual({ chat_id: null, course_id: 7, turns: [{ role: 'assistant', text: 'Light is a wave' }] });
    await expect(liveVoiceApi.save(dashboard, 5, [])).resolves.toBeNull();
  });
});

describe('voice error messages', () => {
  it('explains microphone failures', () => {
    expect(micErrorInfo(new DOMException('no', 'NotAllowedError')).title).toBe('Microphone is blocked');
    expect(micErrorInfo(Object.assign(new Error('x'), { name: 'SecurityError' })).title).toBe('Microphone is blocked');
    expect(micErrorInfo(new DOMException('no', 'NotFoundError')).title).toBe('No microphone found');
    expect(micErrorInfo('weird').title).toBe("Couldn't start the microphone");
  });

  it('explains start failures by status and surface', () => {
    const err = (status: number) => new ApiError({ status, code: 'X', message: 'x' });
    expect(startErrorInfo(new Error('webrtc'), 'lecture')).toMatchObject({ title: "Couldn't connect", retryable: true });
    expect(startErrorInfo(err(401), 'lecture')).toBeNull();
    expect(startErrorInfo(err(429), 'dashboard')).toBeNull();
    expect(startErrorInfo(err(404), 'dashboard')!.message).toContain('right now');
    expect(startErrorInfo(err(404), 'post-assessment')!.message).toContain('for this question yet');
    expect(startErrorInfo(err(404), 'neet-lecture')!.message).toContain('for this lecture yet');
    expect(startErrorInfo(err(503), 'lecture')).toMatchObject({ title: 'Live talk is unavailable', retryable: false });
    expect(startErrorInfo(err(500), 'lecture')).toMatchObject({ title: "Couldn't connect", retryable: true });
    expect(CONNECTION_LOST.retryable).toBe(true);
  });
});
