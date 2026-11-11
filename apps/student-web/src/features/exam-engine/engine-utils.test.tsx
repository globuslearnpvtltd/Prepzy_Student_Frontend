import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { createTestQueryClient } from '@/test/render';
import { API, server } from '@/test/server';
import type { TestAdapter } from './adapters';
import { emptySnapshot } from './attempt';
import { useExamAttempt, useExamResult } from './hooks';
import type { ExamSession, TestContext } from './model';
import { reportProblem } from './report';
import { resolveTestType } from './route-params';
import { testHome } from './test-links';
import { transcribeAudio, useVoiceAnswer } from './transcribe';
import { MAX_IMAGE_BYTES, uploadAnswerImage } from './upload';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
const neet = testExam('neet');

const bigFile = (type: string) => {
  const file = new File(['x'], 'big', { type });
  Object.defineProperty(file, 'size', { value: MAX_IMAGE_BYTES + 1 });
  return file;
};

describe('resolveTestType', () => {
  it('accepts only test types the exam offers', () => {
    expect(resolveTestType('neet', 'dpp')).toBe('dpp');
    expect(resolveTestType('cbse', 'dpp')).toBeNull();
    expect(resolveTestType('cbse', 'nonsense')).toBeNull();
    expect(resolveTestType('gate', 'mock')).toBeNull();
  });
});

describe('testHome', () => {
  it('sends board papers to Assessments and the rest to Learn', () => {
    expect(testHome(cbse, 'mock')).toEqual({ label: 'Assessments', href: '/cbse/assessments' });
    expect(testHome(cbse, 'custom').label).toBe('Assessments');
    expect(testHome(cbse, 'quiz')).toEqual({ label: 'Learn', href: '/cbse/learn' });
  });

  it('sends each competitive type to its own hub', () => {
    expect(testHome(neet, 'mock').href).toBe('/neet/mock-tests');
    expect(testHome(neet, 'pyq')).toEqual({ label: 'PYQ Library', href: '/neet/pyq-library' });
    expect(testHome(neet, 'dpp')).toEqual({ label: 'Daily Practice', href: '/neet/daily-practice' });
    expect(testHome(neet, 'custom')).toEqual({ label: 'Custom Test', href: '/neet/custom-test' });
    expect(testHome(neet, 'practice')).toEqual({ label: 'Learn', href: '/neet/learn' });
  });
});

describe('reportProblem', () => {
  it('rejects oversized screenshots before uploading', async () => {
    await expect(
      reportProblem({ questionId: '1', section: 'Answer', description: 'x', image: bigFile('image/png') }),
    ).rejects.toThrow('5 MB');
  });

  it('sends the report as multipart and surfaces HTTP 200 failures', async () => {
    let form: FormData | null = null;
    server.use(
      http.post(`${API}/api/v4/assessments/reports`, async ({ request }) => {
        form = await request.formData();
        return HttpResponse.json({ success: false, message: 'Already reported' });
      }),
    );
    await expect(reportProblem({ questionId: '9', section: 'Mark', description: '  wrong key  ' })).rejects.toThrow(
      'Already reported',
    );
    const sent = form as unknown as FormData;
    expect(sent.get('question_id')).toBe('9');
    expect(sent.get('description')).toBe('wrong key');
    expect(sent.get('category')).toBe('pyq');
    expect(sent.get('image')).toBeNull();
  });

  it('attaches a screenshot', async () => {
    server.use(http.post(`${API}/api/v4/assessments/reports`, () => HttpResponse.json({ success: true })));
    const image = new File(['a'], 'a.png', { type: 'image/png' });
    expect(await reportProblem({ questionId: '9', section: 'Question', description: 'x', image })).toEqual({ success: true });
  });
});

describe('uploadAnswerImage', () => {
  it('validates type and size', async () => {
    await expect(uploadAnswerImage(new File(['a'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(
      'Please choose an image file.',
    );
    await expect(uploadAnswerImage(bigFile('image/jpeg'))).rejects.toThrow('5 MB');
  });

  it('returns the uploaded image, or fails when the backend sends none', async () => {
    server.use(
      http.post(`${API}/api/v4/assessments/answer-images`, () =>
        HttpResponse.json({ success: true, message: 'Image uploaded', data: { url: 'https://cdn.test/a.png', public_id: 'p1' } }),
      ),
    );
    const file = new File(['a'], 'a.png', { type: 'image/png' });
    expect(await uploadAnswerImage(file)).toEqual({ url: 'https://cdn.test/a.png', publicId: 'p1' });
    server.use(http.post(`${API}/api/v4/assessments/answer-images`, () => HttpResponse.json({ success: true })));
    await expect(uploadAnswerImage(file)).rejects.toThrow('Upload failed');
  });
});

describe('transcribeAudio', () => {
  it('returns trimmed text and rejects silence', async () => {
    server.use(http.post(`${API}/api/v4/chat/transcribe`, () => HttpResponse.json({ success: true, message: 'Audio transcribed', data: { text: ' hi ' } })));
    expect(await transcribeAudio(new Blob(['a']))).toBe('hi');
    server.use(http.post(`${API}/api/v4/chat/transcribe`, () => HttpResponse.json({ success: true, message: 'Audio transcribed', data: { text: '  ' } })));
    await expect(transcribeAudio(new Blob(['a'], { type: 'audio/ogg' }))).rejects.toThrow("couldn't hear anything");
  });
});

/** Minimal MediaRecorder: start() records, stop() emits one chunk then fires onstop. */
class FakeRecorder {
  static last: FakeRecorder | null = null;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = '';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio']) });
    this.onstop?.();
  }
}

describe('useVoiceAnswer', () => {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  it('records, transcribes on stop and hands back the text', async () => {
    getUserMedia.mockResolvedValue(stream);
    server.use(http.post(`${API}/api/v4/chat/transcribe`, () => HttpResponse.json({ success: true, message: 'Audio transcribed', data: { text: 'photosynthesis' } })));
    const onText = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceAnswer(onText, onError));
    expect(result.current.supported).toBe(true);
    await act(() => result.current.start());
    expect(result.current.state).toBe('recording');
    act(() => result.current.stop());
    await waitFor(() => expect(onText).toHaveBeenCalledWith('photosynthesis'));
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(track.stop).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    // Stopping again is a no-op.
    act(() => result.current.stop());
  });

  it('reports transcription failures', async () => {
    getUserMedia.mockResolvedValue(stream);
    server.use(http.post(`${API}/api/v4/chat/transcribe`, () => HttpResponse.json({ success: true, message: 'Audio transcribed', data: { text: '' } })));
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceAnswer(vi.fn(), onError));
    await act(() => result.current.start());
    act(() => result.current.stop());
    await waitFor(() => expect(onError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('reports a denied microphone and releases it on unmount', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const onError = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceAnswer(vi.fn(), onError));
    await act(() => result.current.start());
    expect(onError).toHaveBeenCalled();
    expect(result.current.state).toBe('idle');

    getUserMedia.mockResolvedValue(stream);
    await act(() => result.current.start());
    track.stop.mockClear();
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it('is unsupported without MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { result } = renderHook(() => useVoiceAnswer(vi.fn(), vi.fn()));
    expect(result.current.supported).toBe(false);
  });
});

/* ------------------------------- attempt hook ------------------------------ */

const context: TestContext = { exam: neet, classId: 20 };
const session: ExamSession = {
  key: 'k',
  title: 'Paper',
  questions: [
    { id: '1', kind: 'mcq', typeLabel: 'MCQ', html: 'Q1', image: null, marks: null, options: [], parts: [] },
    { id: '2', kind: 'mcq', typeLabel: 'MCQ', html: 'Q2', image: null, marks: null, options: [], parts: [] },
  ],
  deadline: null,
  initial: emptySnapshot(),
  context: null,
};

function fakeAdapter(save: TestAdapter['save']): TestAdapter {
  return {
    start: vi.fn(),
    save,
    submit: vi.fn(() => Promise.resolve({ attemptId: '5' })),
    result: vi.fn(),
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ExamProvider value={neet}>{children}</ExamProvider>
    </QueryClientProvider>
  );
}

describe('useExamAttempt', () => {
  it('saves on demand, retries after a failed save and uses keepalive when the page closes', async () => {
    const save = vi.fn<TestAdapter['save']>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useExamAttempt(session, fakeAdapter(save), context, vi.fn()), { wrapper });
    act(() => result.current.saveNow());
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    // A failed save leaves the attempt dirty, so going back online saves again.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    act(() => result.current.answer('1', { kind: 'option', optionId: 'a' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(save).toHaveBeenLastCalledWith(session, expect.anything(), context, { keepalive: true });
    // Nothing new to save: no further calls.
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('skips forward, stays on the last question and ignores out-of-range jumps', () => {
    const { result } = renderHook(() => useExamAttempt(session, fakeAdapter(vi.fn()), context, vi.fn()), { wrapper });
    act(() => result.current.goTo(5));
    expect(result.current.index).toBe(0);
    act(() => result.current.skip());
    expect(result.current.index).toBe(1);
    act(() => result.current.skip());
    expect(result.current.index).toBe(1);
    expect(result.current.snapshot.visited).toEqual(['1', '2']);
    act(() => result.current.toggleMark('2'));
    expect(result.current.snapshot.marked).toEqual(['2']);
  });

  it('opens an empty paper without a current question', () => {
    const { result } = renderHook(
      () => useExamAttempt({ ...session, questions: [] }, fakeAdapter(vi.fn()), context, vi.fn()),
      { wrapper },
    );
    expect(result.current.question).toBeUndefined();
    act(() => result.current.skip());
    expect(result.current.index).toBe(0);
  });

  it('submits and reports the outcome', async () => {
    const onSubmitted = vi.fn();
    const { result } = renderHook(() => useExamAttempt(session, fakeAdapter(vi.fn()), context, onSubmitted), { wrapper });
    act(() => result.current.submit.mutate());
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith({ attemptId: '5' }));
  });
});

describe('useExamResult', () => {
  it('stays idle for a test type the exam lacks', () => {
    const { result } = renderHook(() => useExamResult('mid', '1'), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
