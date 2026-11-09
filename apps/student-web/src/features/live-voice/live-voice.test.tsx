import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { FakePeerConnection, installVoiceFakes, removeVoiceFakes, type VoiceFakes } from '@/test/fake-webrtc';
import { API, server } from '@/test/server';
import { LiveTalkMiniBar, LiveTalkSummary, LiveVoiceLayer, LiveVoiceProvider, useLiveVoice } from './index';
import { formatClock, formatDuration, htmlToPlain, splitAvatarName, splitReply, tokenizeSpoken, voiceReplyToPlain } from './text';
import type { VoiceConfig } from './types';

const CONFIG: VoiceConfig = { variant: 'lecture', courseId: 7, lectureId: 70 };
const AVATAR = { name: 'CV Raman, The Physicist', image: null };

let fakes: VoiceFakes;
let starts: Record<string, unknown>[];
let saves: Record<string, unknown>[];

function backend(kind = 'lecture') {
  server.use(
    http.post(`${API}/api/v1/chat/${kind}-voice/start`, async ({ request }) => {
      starts.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ success: true, data: { sdp: 'answer-sdp', type: 'answer' } });
    }),
    http.post(`${API}/api/v1/chat/${kind}-voice/save`, async ({ request }) => {
      saves.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ success: true, data: { chat_id: 5 } });
    }),
  );
}

function Probe() {
  const voice = useLiveVoice();
  return (
    <>
      <button type="button" onClick={() => voice?.requestStart({ avatar: AVATAR, chatId: 3, history: [] })}>
        Start talk
      </button>
      <span data-testid="phase">{voice?.phase}</span>
      <LiveTalkMiniBar variant="inline" />
      <LiveTalkSummary onBack={onBack} />
    </>
  );
}
const onBack = vi.fn();
const onType = vi.fn();

function renderVoice(config: VoiceConfig = CONFIG) {
  return render(
    <LiveVoiceProvider config={config}>
      <Probe />
      <LiveVoiceLayer chatOpen={false} onOpenChat={onType} />
    </LiveVoiceProvider>,
  );
}

const events = () => FakePeerConnection.last!.events;
const emit = (event: object) => act(() => events().emit(event));

beforeEach(() => {
  fakes = installVoiceFakes('prompt');
  starts = [];
  saves = [];
  localStorage.clear();
});
afterEach(() => removeVoiceFakes());

describe('live talk screens', () => {
  it('asks for the mic, then walks through a call: listening, caption, thinking, answer, controls, end', async () => {
    backend();
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));

    const sheet = await screen.findByRole('dialog', { name: 'Microphone access' });
    expect(within(sheet).getByText('Let CV Raman hear you')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Allow microphone' }));

    const talk = await screen.findByRole('dialog', { name: 'Live talk with CV Raman' });
    expect(within(talk).getByText('Getting ready')).toBeInTheDocument();
    expect(within(talk).getByText('Microphone is working')).toBeInTheDocument();
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({ course_id: 7, lecture_id: 70, sdp: 'offer-sdp' });

    emit({ type: 'ready' });
    expect(within(talk).getByText('Your turn')).toBeInTheDocument();
    expect(within(talk).getByText('“Explain the last part again”')).toBeInTheDocument();
    expect(within(talk).getByText('00:00')).toBeInTheDocument();

    emit({ type: 'user_interim', text: 'Why is the sky' });
    expect(within(talk).getByText('Listening…')).toBeInTheDocument();
    expect(within(talk).getByText('Why is the sky')).toBeInTheDocument();
    emit({ type: 'user_final', text: 'Why is the sky blue?' });
    expect(within(talk).getByText('Got it')).toBeInTheDocument();
    emit({ type: 'state', value: 'thinking' });
    expect(within(talk).getByText('Thinking…')).toBeInTheDocument();
    expect(within(talk).getByText('Why is the sky blue?')).toBeInTheDocument();
    expect(within(talk).getByText('Checking this lecture…')).toBeInTheDocument();

    emit({ type: 'bot_start' });
    emit({ type: 'bot_delta', text: 'Scattering, mostly. <solution>I ∝ 1/λ⁴</solution>' });
    expect(within(talk).getByText('CV Raman is explaining')).toBeInTheDocument();
    expect(within(talk).getByText('Scattering,')).toBeInTheDocument();
    expect(within(talk).getByText('Worked solution')).toBeInTheDocument();
    expect(within(talk).getByText('Source: CBSE Textbook')).toBeInTheDocument();

    await userEvent.click(within(talk).getByRole('button', { name: "Pause CV Raman's voice" }));
    expect(within(talk).getByText(/· paused/)).toBeInTheDocument();
    await userEvent.click(within(talk).getByRole('button', { name: "Resume CV Raman's voice" }));

    emit({ type: 'user_interim', text: 'Wait' });
    expect(within(talk).getByText('I’m listening')).toBeInTheDocument();
    expect(within(talk).getByText('Stopped for you')).toBeInTheDocument();
    emit({ type: 'bot_end', interrupted: true });
    emit({ type: 'state', value: 'listening' });

    await userEvent.click(within(talk).getByRole('button', { name: 'Mute' }));
    expect(within(talk).getByText('You’re muted. Unmute to ask.')).toBeInTheDocument();
    expect(fakes.streams[0]!.tracks[0]!.enabled).toBe(false);
    await userEvent.click(within(talk).getByRole('button', { name: 'Unmute' }));

    // Minimise: a mini bar takes over, and reopens the screen.
    await userEvent.click(within(talk).getByRole('button', { name: 'Minimise and go back to the lecture' }));
    expect(talk).not.toBeVisible();
    const open = await screen.findAllByRole('button', { name: 'Open live talk with CV Raman' });
    expect(open.length).toBeGreaterThan(0);
    expect(screen.getAllByText('CV Raman is listening').length).toBeGreaterThan(0);
    await userEvent.click(open[0]!);
    expect(talk).toBeVisible();

    await userEvent.click(within(talk).getByRole('button', { name: 'End' }));
    expect(onType).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Live talk with CV Raman' })).not.toBeInTheDocument();
    const summary = await screen.findByText(/Live talk ended, 0 s/);
    expect(summary).toBeInTheDocument();
    expect(screen.getByText('Live talk with CV Raman')).toBeInTheDocument();
    expect(screen.getByText('2 turns')).toBeInTheDocument();
    expect(screen.getByText('· stopped')).toBeInTheDocument();
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ chat_id: 3, course_id: 7 });
    await waitFor(() => expect(screen.queryByText(/saving…/)).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Back to lecture' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('switches the tutor language mid-call (reconnects) and remembers it', async () => {
    backend('dashboard');
    fakes.permission.state = 'granted';
    renderVoice({ variant: 'dashboard', classId: 10 });
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));
    const talk = await screen.findByRole('dialog', { name: 'Live talk with CV Raman' });
    await waitFor(() => expect(starts).toHaveLength(1));
    emit({ type: 'ready' });
    expect(within(talk).getByText('“Explain a topic I’m stuck on”')).toBeInTheDocument();

    await userEvent.click(within(talk).getByRole('button', { name: /Tutor language: English/ }));
    const menu = within(talk).getByRole('menu', { name: 'Tutor language' });
    expect(within(menu).getByText('Changing it reconnects the live talk.')).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /Hinglish/ }));
    await waitFor(() => expect(starts).toHaveLength(2));
    expect(starts[1]).toMatchObject({ language: 'hinglish', class_id: 10 });
    expect(localStorage.getItem('prepzy-live-voice-language')).toBe('hinglish');
    expect(within(talk).getByRole('button', { name: /Tutor language: Hinglish/ })).toBeInTheDocument();
  });

  it('shows a blocked-mic error with retry and "type instead"', async () => {
    backend();
    fakes.permission.state = 'granted';
    fakes.getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone is blocked');
    expect(screen.getByText(/Allow microphone access for Prepzy/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(screen.getByText('Getting ready')).toBeInTheDocument();

    act(() => FakePeerConnection.last!.setConnectionState('failed'));
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
    await userEvent.click(screen.getByRole('button', { name: 'Type your doubt instead' }));
    expect(onType).toHaveBeenCalled();
    expect(screen.getByTestId('phase')).toHaveTextContent('idle');
    expect(screen.queryByRole('dialog', { name: /Live talk/ })).not.toBeInTheDocument();
  });

  it('closes the error screen with "Close" and cancels from the mic sheet', async () => {
    backend();
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Microphone access' })).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog', { name: 'Microphone access' })).not.toBeInTheDocument();
    expect(fakes.getUserMedia).not.toHaveBeenCalled();

    server.use(http.post(`${API}/api/v1/chat/lecture-voice/start`, () => HttpResponse.json({ message: 'off' }, { status: 503 })));
    fakes.permission.state = 'granted';
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Live talk is unavailable');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: /Live talk/ })).not.toBeInTheDocument();
  });

  it('hangs up and saves when the surface unmounts', async () => {
    backend();
    fakes.permission.state = 'granted';
    const view = renderVoice();
    await userEvent.click(screen.getByRole('button', { name: 'Start talk' }));
    await waitFor(() => expect(starts).toHaveLength(1));
    emit({ type: 'ready' });
    emit({ type: 'user_final', text: 'Bye' });
    const pc = FakePeerConnection.last!;
    view.unmount();
    expect(pc.closed).toBe(true);
    expect(fakes.streams[0]!.tracks[0]!.stopped).toBe(true);
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ turns: [{ role: 'user', text: 'Bye' }] });
  });
});

describe('voice text helpers', () => {
  it('splits solutions, tokenises maths and formats clocks', () => {
    expect(splitReply('Hi <solution>a</solution> there <solu')).toEqual({ spoken: 'Hi there', solutions: ['a'], solutionOpen: false });
    expect(splitReply('Step <solution>x =')).toEqual({ spoken: 'Step', solutions: ['x ='], solutionOpen: true });
    expect(tokenizeSpoken('so \\(x^2\\) then \\[y\\] and \\(z')).toEqual([
      { kind: 'word', text: 'so' },
      { kind: 'math', text: '\\(x^2\\)', display: false },
      { kind: 'word', text: 'then' },
      { kind: 'math', text: '\\[y\\]', display: true },
      { kind: 'word', text: 'and' },
    ]);
    expect(htmlToPlain('<p>A <b>bold</b>  idea</p>')).toBe('A bold idea');
    expect(htmlToPlain('')).toBe('');
    expect(voiceReplyToPlain('Ok <solution>x = 2</solution>')).toBe('Ok \n\nWorked solution:\nx = 2');
    expect(formatClock(75)).toBe('01:15');
    expect(formatDuration(75)).toBe('1 min 15 s');
    expect(formatDuration(9)).toBe('9 s');
    expect(splitAvatarName('CV Raman, The Physicist')).toEqual({ name: 'CV Raman', title: 'The Physicist' });
    expect(splitAvatarName(null).name).toBe('Tutor');
  });
});
