'use client';

import { cx } from '@prepzy/design-system';
import { ChevronDown, ChevronUp, History, Loader2, Maximize2, Minimize2, Pause, SquarePen, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { htmlToPlain, LiveTalkMiniBar, LiveTalkSummary, useLiveVoice, type VoiceTurn } from '@/features/live-voice';
import type { ExamConfig } from '@/shared/config/exams';
import type { AtlasSurface, ChatMessage, ChatSources } from '../api';
import { useAtlasChat, useAtlasHistory, useReadAloud } from '../hooks';
import { ATLAS_IMAGE, Avatar, ChatImage, ChatText, Drawer, HistoryList, TypingDots } from './chat-kit';
import { Composer } from './composer';

const SUGGESTIONS = ['What is photosynthesis?', 'Explain Newton’s third law with an example', 'Difference between weather and climate'];

const iconButton =
  'bg-socrates-chip text-brand hover:bg-socrates-chip-hover flex size-8 items-center justify-center rounded-full disabled:opacity-50';

export interface AtlasPanelProps {
  exam: ExamConfig;
  surface: AtlasSurface;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  onClose: () => void;
}

/** The Atlas chat: header, conversation, follow-ups, composer and history. */
export function AtlasPanel({ exam, surface, expanded, onExpand, onClose }: AtlasPanelProps) {
  const chat = useAtlasChat(exam, surface);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useAtlasHistory(exam, surface, historyOpen || expanded);
  const bottom = useRef<HTMLDivElement>(null);
  const isLecture = surface.kind === 'lecture';
  const name = isLecture ? (chat.avatar?.name ?? (exam.category === 'competitive' ? 'Prepzy NEET Tutor' : 'your tutor')) : 'Atlas';
  const avatarSrc = isLecture ? (chat.avatar?.image ?? null) : null;

  // Live voice (provided by the host above the panel, so a call outlives closing the chat).
  const voice = useLiveVoice();
  const voiceSession = voice?.lastSession && !voice.isActive ? voice.lastSession : null;
  const talkLive = () => {
    if (!voice) return;
    const history: VoiceTurn[] = chat.messages
      .map((m): VoiceTurn => ({ role: m.fromStudent ? 'user' : 'assistant', text: htmlToPlain(m.text) }))
      .filter((turn) => turn.text);
    voice.requestStart({
      avatar: isLecture ? (chat.avatar ?? null) : { name: chat.avatar?.name ?? 'Atlas', image: chat.avatar?.image ?? ATLAS_IMAGE },
      chatId: chat.chatId,
      history,
    });
  };

  // A saved call is part of the chat on the server now: reload it (it may even be the student's first chat).
  const savedSession = voiceSession?.saved ? voiceSession : null;
  const savedChatId = voice?.savedChatId ?? null;
  const reloadChat = chat.reload;
  const markHistoryLoaded = voice?.markHistoryLoaded;
  const reloadedFor = useRef<object | null>(null);
  useEffect(() => {
    if (!savedSession || !savedChatId || reloadedFor.current === savedSession) return;
    reloadedFor.current = savedSession;
    void reloadChat(savedChatId)
      .then(() => markHistoryLoaded?.())
      .catch(() => undefined);
  }, [savedSession, savedChatId, reloadChat, markHistoryLoaded]);

  // While the "Live talk ended" card shows, the reloaded thread already ends with the same turns: hide them there.
  const messages = useMemo(() => {
    if (!savedSession) return chat.messages;
    const n = savedSession.turns.length;
    if (chat.messages.length < n) return chat.messages;
    const tail = chat.messages.slice(-n);
    const same = tail.every((m, i) => {
      const turn = savedSession.turns[i]!;
      return m.fromStudent === (turn.role === 'user') && (turn.role !== 'user' || m.text.trim() === turn.text);
    });
    return same ? chat.messages.slice(0, -n) : chat.messages;
  }, [chat.messages, savedSession]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.thinking, voiceSession]);

  const send = (text: string, image: File | null = null) => {
    voice?.dismissSummary();
    chat.send(text, image);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !historyOpen && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyOpen, onClose]);

  const historyProps = {
    title: 'Chat history',
    newLabel: 'New chat',
    emptyText: 'No chats in the last 7 days.',
    errorText: "Couldn't load your chats.",
    items: history.data,
    loading: history.isPending,
    error: history.isError,
    activeId: chat.chatId,
    onSelect: (id: number) => {
      setHistoryOpen(false);
      chat.openChat(id);
    },
    onNew: () => {
      setHistoryOpen(false);
      voice?.dismissSummary();
      chat.newChat();
    },
    onRetry: () => void history.refetch(),
  };

  return (
    <section
      role="dialog"
      aria-label={`${name} chat`}
      className={cx('bg-surface relative flex h-full w-full flex-col overflow-hidden', !expanded && 'md:rounded-lg')}
    >
      <header className="border-socrates-divider bg-surface flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={avatarSrc} size={44} pending={isLecture && chat.avatarPending} />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-socrates-ink truncate font-serif text-[18px] leading-[22px] font-semibold">{isLecture ? name : 'Atlas'}</h2>
            <p className="text-socrates-muted truncate text-[12px] leading-4">{isLecture ? 'Ask about this lecture' : 'Quick answers, any subject'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label="Chat history" title="Chat history" onClick={() => setHistoryOpen(true)} className={cx(iconButton, expanded && 'md:hidden')}>
            <History aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={() => {
              voice?.dismissSummary();
              chat.newChat();
            }} disabled={chat.busy} className={cx(iconButton, expanded && 'md:hidden')}>
            <SquarePen aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse' : 'Expand'}
            onClick={() => onExpand(!expanded)}
            className={cx(iconButton, 'hidden md:flex')}
          >
            {expanded ? <Minimize2 aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
          </button>
          <span aria-hidden className="bg-socrates-line mx-1 h-[22px] w-px" />
          <button type="button" aria-label="Close chat" title="Close" onClick={onClose} className="text-socrates-muted hover:bg-socrates-soft flex size-8 items-center justify-center rounded-full">
            <X aria-hidden className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {expanded && (
          <aside className="border-socrates-divider hidden w-[300px] shrink-0 border-r md:block lg:w-[340px]">
            <HistoryList {...historyProps} />
          </aside>
        )}
        <div className={cx('flex min-w-0 flex-1 flex-col', expanded && 'md:px-8 lg:px-16 xl:px-24')}>
          {voice && <LiveTalkMiniBar variant="inline" />}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-5">
            {chat.loading ? (
              <div className="flex h-full items-center justify-center" role="status" aria-label="Loading chat">
                <Loader2 aria-hidden className="text-brand size-6 animate-spin" />
              </div>
            ) : chat.loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-socrates-ink font-serif text-[18px] font-semibold">{name} is taking a short break</p>
                <p className="text-socrates-muted text-[13px]">We couldn&apos;t load your chat. Please try again.</p>
                <button type="button" onClick={chat.retry} className="bg-brand text-on-brand rounded-full px-5 py-2 text-[13px] font-semibold">
                  Try again
                </button>
              </div>
            ) : messages.length === 0 && !chat.thinking && !voiceSession ? (
              <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
                <Avatar src={avatarSrc} size={76} pending={isLecture && chat.avatarPending} />
                <h3 className="text-socrates-ink mt-3 font-serif text-[20px] leading-7 font-semibold">Ask {name} anything</h3>
                <p className="text-socrates-muted mt-2 max-w-[260px] text-[13px] leading-[19px]">
                  {isLecture ? 'Stuck on something in this lecture? Ask away.' : 'Quick, complete answers to any doubt, in any subject.'}
                </p>
                {!isLecture && (
                  <div className="mt-6 flex flex-col items-center gap-2.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="border-socrates-line text-socrates-text hover:bg-socrates-soft rounded-full border px-4 py-2 text-[12.5px]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ol className="flex flex-col gap-4" aria-label="Conversation">
                {messages.map((message) => (
                  <li key={message.id}>
                    <Message message={message} avatarSrc={avatarSrc} competitive={exam.category === 'competitive'} />
                  </li>
                ))}
                {chat.thinking && (
                  <li className="flex items-start gap-2.5">
                    <Avatar src={avatarSrc} size={32} />
                    <div className="border-socrates-line bg-surface rounded-lg rounded-tl-[4px] border px-4 py-3">
                      <TypingDots />
                    </div>
                  </li>
                )}
                {chat.failed && (
                  <li role="alert" className="text-socrates-error text-center text-[12px]">
                    Something went wrong. Please try again.
                  </li>
                )}
                {chat.followups.length > 0 && !chat.thinking && (
                  <li className="flex flex-wrap gap-2 pl-[42px]" aria-label="Suggested questions">
                    {chat.followups.map((followup) => (
                      <button
                        key={followup}
                        type="button"
                        onClick={() => send(followup)}
                        className="border-socrates-line text-brand hover:bg-socrates-soft rounded-full border px-3 py-1.5 text-left text-[12px] font-medium"
                      >
                        {followup}
                      </button>
                    ))}
                  </li>
                )}
                {voiceSession && (
                  <li>
                    <LiveTalkSummary onBack={onClose} backLabel={isLecture ? 'Back to lecture' : 'Close chat'} />
                  </li>
                )}
                <div ref={bottom} />
              </ol>
            )}
          </div>

          <div className="shrink-0 px-3 pt-2 pb-1.5 md:px-4">
            <Composer
              placeholder="Ask your Question..."
              onSend={send}
              disabled={chat.loading || chat.loadError}
              allowVoice
              allowInk
              inkDraftKey={`${isLecture ? 'lecture' : 'atlas'}:${chat.chatId ?? 'new'}`}
              onLiveChat={voice ? talkLive : undefined}
              liveActive={!!voice?.isActive}
              liveDisabled={chat.thinking}
            />
          </div>
          <p className="text-socrates-faint pb-2.5 text-center text-[11px] leading-[15px]">
            {name === 'Atlas' ? 'Atlas' : 'Prepzy'} can make mistakes. Check important answers.
          </p>
        </div>
      </div>

      <Drawer open={historyOpen} label="Chat history" onClose={() => setHistoryOpen(false)} contained>
        <HistoryList {...historyProps} onClose={() => setHistoryOpen(false)} />
      </Drawer>
    </section>
  );
}

function Sources({ sources, competitive }: { sources: ChatSources; competitive: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-socrates-divider mt-2.5 border-t pt-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-brand flex items-center gap-1 text-[11.5px] font-semibold">
        View source{!competitive && ' · CBSE textbook'}
        {open ? <ChevronUp aria-hidden className="size-3.5" /> : <ChevronDown aria-hidden className="size-3.5" />}
      </button>
      {open && (
        <div className="text-socrates-body mt-1.5 flex flex-col gap-0.5 text-[12px] leading-[17px]">
          <span>
            {competitive ? `${sources.subject ? `${sources.subject} • ` : ''}${sources.book ?? ''} ${sources.className ?? ''}` : `NCERT ${sources.book ?? ''} ${sources.className ?? ''}`}
          </span>
          {sources.chapter && <span>Chapter: {sources.chapter}</span>}
          {sources.lecture && <span>Lecture: {sources.lecture}</span>}
        </div>
      )}
    </div>
  );
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function Message({ message, avatarSrc, competitive }: { message: ChatMessage; avatarSrc: string | null; competitive: boolean }) {
  const audio = useReadAloud();
  if (message.fromStudent) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {message.image && <ChatImage src={message.image} alt="Your picture" />}
        {message.text && (
          <div className="from-brand-450 to-brand text-on-brand max-w-[80%] rounded-lg rounded-tr-[4px] bg-linear-to-r px-3.5 py-2.5 text-[13.5px] leading-5">
            <ChatText text={message.text} />
          </div>
        )}
      </div>
    );
  }
  const playing = audio.playing === message.id;
  return (
    <div className="flex items-start gap-2.5">
      <Avatar src={avatarSrc} size={32} />
      <div className="flex max-w-[85%] min-w-0 flex-col items-start">
        <div className="border-socrates-line bg-surface shadow-socrates-bubble text-socrates-text rounded-lg rounded-tl-[4px] border px-4 py-3 text-[13.5px] leading-[21px]">
          {(message.textbookImage || message.image) && (
            <div className="border-socrates-line bg-socrates-soft mb-2.5 rounded-md border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={message.textbookImage ?? message.image ?? ''} alt="Diagram" className="max-h-[260px] w-full rounded-sm object-contain" />
            </div>
          )}
          <ChatText text={message.text} />
          {message.sources && <Sources sources={message.sources} competitive={competitive} />}
        </div>
        <button
          type="button"
          disabled={audio.loading === message.id}
          aria-label={playing ? 'Stop reading' : 'Read aloud'}
          onClick={() => (playing ? audio.stop() : void audio.play(message.id, plainText(message.text)))}
          className="text-brand mt-2 disabled:opacity-50"
        >
          {audio.loading === message.id ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : playing ? (
            <Pause aria-hidden className="size-4" />
          ) : (
            <Volume2 aria-hidden className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
