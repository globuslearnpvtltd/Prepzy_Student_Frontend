'use client';

import { Check, Loader2, Pause, Play, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  formatClock,
  formatDuration,
  htmlToPlain,
  LiveTalkMiniBar,
  LiveVoiceLayer,
  LiveVoiceProvider,
  LiveWaveIcon,
  useLiveVoice,
  voiceReplyToPlain,
  type VoiceConfig,
  type VoiceTurn,
} from '@/features/live-voice';
import type { ExamRef } from '@/shared/config/exams';
import { useExam } from '@/shared/hooks/use-exam';
import type { ReviewContext } from '../api';
import { useReadAloud, useReviewChat } from '../hooks';
import { Avatar, ChatText, TypingDots } from './chat-kit';
import { Composer } from './composer';

export const VEDICA_IMAGE = '/illustrations/tests/vedica.jpg';
const VEDICA = { name: 'Vedica', image: VEDICA_IMAGE };

/** What Vedica's live talk knows about the question: the same fields as her text chat. */
export function reviewVoiceConfig(exam: ExamRef, ctx: ReviewContext): VoiceConfig {
  const ids = { assessment_id: ctx.assessmentId, question_id: ctx.questionId, attempt_id: ctx.attemptId };
  const question = htmlToPlain(ctx.questionText);
  if (exam.category === 'competitive') {
    return {
      variant: 'neet-post-assessment',
      exam,
      postAssessment: {
        ...ids,
        question,
        question_diagram: ctx.questionDiagram ?? '',
        options: ctx.options ?? [],
        correct_option_id: ctx.correctOptionId ?? null,
        selected_option_id: ctx.selectedOptionId ?? null,
        explanation: ctx.feedback ?? '',
      },
    };
  }
  return {
    variant: 'post-assessment',
    exam,
    postAssessment: {
      ...ids,
      sub_question_id: ctx.subQuestionId ?? null,
      question,
      question_diagram: ctx.questionDiagram ?? '',
      sample_answer: ctx.sampleAnswer ?? '',
      sample_diagram: '',
      student_answer: ctx.studentAnswer ?? '',
      student_diagram: '',
      marks_awarded: Number(ctx.marksAwarded) || 0,
      total_marks: Number(ctx.totalMarks) || 0,
      feedback: ctx.feedback ?? '',
    },
  };
}

/**
 * "Discuss with Vedica" after a test: a right-hand drawer chat about one question that knows the student's
 * answer and marks. Replies stream in; "Talk live" opens a live voice talk about the same question. The
 * voice provider lives here, so closing the chat hangs up (and saves) a running call.
 */
export function ReviewChat({ context, open, onClose }: { context: ReviewContext; open: boolean; onClose: () => void }) {
  const exam = useExam();
  // The result page rebuilds the context on every render; key the config on its content.
  const contextKey = JSON.stringify(context);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the context's content
  const voiceConfig = useMemo(() => reviewVoiceConfig(exam, context), [exam, contextKey]);
  if (!open) return null;
  return (
    <LiveVoiceProvider config={voiceConfig}>
      <ReviewChatPanel context={context} onClose={onClose} />
    </LiveVoiceProvider>
  );
}

const talkLiveButton = (size: string) =>
  `from-voice-indigo to-voice-violet hover:from-voice-indigo-hover hover:to-voice-violet-hover text-on-brand shadow-voice-cta flex flex-none items-center gap-[6px] rounded-full bg-linear-to-r font-semibold transition-all active:scale-[0.97] ${size}`;

function ReviewChatPanel({ context, onClose }: { context: ReviewContext; onClose: () => void }) {
  const exam = useExam();
  const competitive = exam.category === 'competitive';
  const chat = useReviewChat(exam, context, true);
  const voice = useLiveVoice();
  const audio = useReadAloud();
  const bottom = useRef<HTMLDivElement>(null);
  const last = chat.messages.at(-1);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [chat.messages.length, last?.text]);

  const close = () => {
    audio.stop();
    onClose();
  };

  const talkLive = () => {
    if (!voice) return;
    audio.stop();
    voice.dismissSummary();
    const history: VoiceTurn[] = chat.messages
      .filter((m) => m.text.trim() && !m.error)
      .map((m) => ({ role: m.fromStudent ? 'user' : 'assistant', text: htmlToPlain(m.text) }));
    voice.requestStart({ avatar: VEDICA, chatId: null, history });
  };

  // When a live talk ends, its turns go into the thread right away (the save runs in the background).
  const session = voice?.lastSession ?? null;
  const appended = useRef<VoiceTurn[] | null>(null);
  const appendTurns = chat.appendTurns;
  useEffect(() => {
    if (!session || appended.current === session.turns) return;
    appended.current = session.turns;
    appendTurns(session.turns.map((t) => ({ role: t.role, text: t.role === 'assistant' ? voiceReplyToPlain(t.text) : t.text, image: t.image ?? null })));
  }, [session, appendTurns]);
  // Saved turns are part of the thread now, so the next call doesn't need them as extra history.
  const saved = !!session?.saved;
  const markHistoryLoaded = voice?.markHistoryLoaded;
  useEffect(() => {
    if (saved) markHistoryLoaded?.();
  }, [saved, markHistoryLoaded]);

  const ask = (text: string, image: File | null = null) => {
    audio.stop();
    voice?.dismissSummary();
    void chat.ask(text, image);
  };

  const lastReply = [...chat.messages].reverse().find((m) => !m.fromStudent && m.text && !m.error);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="bg-night-900/30 absolute inset-0" onClick={close} />
      <section role="dialog" aria-label="Discuss with Vedica" className="bg-surface relative z-10 flex h-full w-full max-w-[460px] flex-col shadow-lg">
        <header className="border-socrates-divider flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar src={VEDICA_IMAGE} size={40} />
            <div className="flex flex-col">
              <h2 className="text-socrates-ink font-serif text-[18px] leading-[22px] font-semibold">Vedica</h2>
              <p className="text-success-500 flex items-center gap-1 text-[12px] font-medium">
                <span aria-hidden className="bg-success-500 size-2 rounded-full" />
                Online
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close chat" onClick={close} className="text-socrates-muted hover:bg-socrates-soft flex size-8 items-center justify-center rounded-full">
            <X aria-hidden className="size-5" />
          </button>
        </header>

        {voice && <LiveTalkMiniBar variant="inline" />}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="border-socrates-line bg-socrates-soft text-socrates-text mb-4 rounded-md border px-3.5 py-2.5 text-[13px]">
            <span className="text-brand font-semibold">Q. </span>
            <ChatText text={context.questionText} className="inline" />
          </div>
          {chat.loading ? (
            <div role="status" aria-label="Loading chat" className="flex justify-center py-6">
              <Loader2 aria-hidden className="text-brand size-6 animate-spin" />
            </div>
          ) : chat.messages.length === 0 ? (
            voice && !voice.isActive ? (
              <div className="border-voice-indigo-line from-voice-indigo-soft to-voice-soft flex items-center gap-3 rounded-lg border bg-linear-to-br p-[14px]">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-voice-ink text-[14px] leading-[1.3] font-semibold">Rather talk it through?</span>
                  <span className="text-socrates-muted text-[12px] leading-[1.45]">
                    Vedica already has your answer and {competitive ? 'the explanation' : 'marks'}. Just ask out loud.
                  </span>
                </div>
                <button type="button" onClick={talkLive} className={talkLiveButton('h-9 pr-[14px] pl-[6px] text-[13px]')}>
                  <LiveWaveIcon />
                  Talk live
                </button>
              </div>
            ) : (
              <p className="text-socrates-muted py-6 text-center text-[13px]">Ask Vedica anything about this question.</p>
            )
          ) : (
            <ol aria-label="Conversation" className="flex flex-col gap-4">
              {chat.messages.map((message) =>
                message.fromStudent ? (
                  <li key={message.id} className="flex flex-col items-end gap-1.5">
                    {message.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview or backend upload
                      <img src={message.image} alt="Your photo" className="border-socrates-line max-w-[200px] rounded-md border object-contain" />
                    )}
                    {message.text && (
                      <div className="from-brand-450 to-brand text-on-brand max-w-[80%] rounded-lg rounded-tr-[4px] bg-linear-to-r px-3.5 py-2.5 text-[13.5px] leading-5 break-words">
                        {message.text}
                      </div>
                    )}
                  </li>
                ) : (
                  <li key={message.id} className="flex items-start gap-2.5">
                    <Avatar src={VEDICA_IMAGE} size={32} />
                    <div className="flex max-w-[85%] min-w-0 flex-col items-start">
                      {message.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- figure from a live talk
                        <img src={message.image} alt="Figure" className="border-socrates-line mb-2 max-w-[220px] rounded-md border object-contain" />
                      )}
                      <div
                        className={
                          message.error
                            ? 'border-danger-50 bg-danger-50 text-socrates-error rounded-lg rounded-tl-[4px] border px-4 py-3 text-[13.5px]'
                            : 'border-socrates-line bg-surface shadow-socrates-bubble text-socrates-text rounded-lg rounded-tl-[4px] border px-4 py-3 text-[13.5px] leading-[21px]'
                        }
                      >
                        {message.text ? <ChatText text={message.text} /> : <TypingDots label="Vedica is typing" />}
                      </div>
                      {message === lastReply && !chat.streaming && (
                        <button
                          type="button"
                          disabled={audio.loading === message.id}
                          aria-label={audio.playing === message.id ? 'Pause audio' : 'Play audio'}
                          onClick={() => (audio.playing === message.id ? audio.stop() : void audio.play(message.id, htmlToPlain(message.text)))}
                          className="border-socrates-line bg-surface text-socrates-ink mt-2 flex size-8 items-center justify-center rounded-sm border-[1.5px] disabled:opacity-50"
                        >
                          {audio.loading === message.id ? (
                            <Loader2 aria-hidden className="size-4 animate-spin" />
                          ) : audio.playing === message.id ? (
                            <Pause aria-hidden className="size-4" />
                          ) : (
                            <Play aria-hidden className="size-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
          {chat.followups.length > 0 && !chat.streaming && (
            <div aria-label="Suggested questions" className="mt-4 flex flex-wrap gap-2 pl-[42px]">
              {chat.followups.map((followup) => (
                <button
                  key={followup}
                  type="button"
                  onClick={() => ask(followup)}
                  className="border-socrates-line text-brand hover:bg-socrates-soft rounded-full border px-3 py-1.5 text-left text-[12px] font-medium"
                >
                  {followup}
                </button>
              ))}
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="border-socrates-divider shrink-0 border-t px-4 pt-3 pb-3">
          {voice && session && !voice.isActive && (
            <div role="status" className="bg-voice-ok-soft mb-[10px] flex items-center gap-2 rounded-[12px] py-[6px] pr-[6px] pl-3">
              <Check aria-hidden className="text-voice-ok size-4" strokeWidth={2.6} />
              <span className="text-voice-ink flex-1 text-[12px] font-medium">
                Live talk ended, {formatDuration(session.durationSec)} · {session.saved ? 'saved to chat' : 'saving…'}
              </span>
              <button type="button" onClick={talkLive} className="text-voice-indigo hover:bg-voice-ok-hover h-[30px] rounded-[10px] px-[10px] text-[12px] font-semibold">
                Talk again
              </button>
              <button
                type="button"
                onClick={voice.dismissSummary}
                aria-label="Dismiss"
                className="text-socrates-muted hover:bg-voice-ok-hover flex size-[30px] items-center justify-center rounded-[10px]"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )}
          {chat.streaming && (
            <button type="button" onClick={chat.stop} className="text-brand mx-auto mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
              <Square aria-hidden className="size-3" /> Stop
            </button>
          )}
          <Composer
            placeholder="Ask Vedica about this question…"
            onSend={ask}
            disabled={chat.streaming}
            // Board answers can come with a photo (as before); NEET's chat takes text only.
            allowImage={!competitive}
            imageOnly={!competitive}
            // Live talk replaces voice-to-text here: Vedica hears the student directly.
            allowVoice={!voice}
            toolbarSlot={
              voice ? (
                <button
                  type="button"
                  onClick={voice.isActive ? voice.openScreen : talkLive}
                  aria-label={voice.isActive ? 'Open live talk with Vedica' : 'Talk live with Vedica'}
                  className={talkLiveButton('h-[30px] pr-3 pl-1 text-[12px]')}
                >
                  <LiveWaveIcon live={voice.isActive} />
                  <span className="whitespace-nowrap tabular-nums">{voice.isActive ? `Live ${formatClock(voice.elapsed)}` : 'Talk live'}</span>
                </button>
              ) : null
            }
          />
          <p className="text-socrates-faint mt-2 text-center text-[11px]">Prepzy can make mistakes</p>
        </div>
      </section>

      {/* The chat is open behind it, so "Type" just minimises the call back to the input. */}
      {voice && <LiveVoiceLayer chatOpen drawer onOpenChat={() => undefined} />}
    </div>
  );
}
