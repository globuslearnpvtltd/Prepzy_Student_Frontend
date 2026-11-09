'use client';

import { cx } from '@prepzy/design-system';
import { ChevronDown, ChevronUp, Lightbulb, Lock, RotateCw } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChatText, Composer, SOCRATES_IMAGE, TypingDots } from '@/features/assistant/ui';
import type { ConceptCard, Sources } from '../api';
import { useSolverChat, type ChatEntry } from '../hooks';
import { useSolver } from '../store';
import { useExam } from '@/shared/hooks/use-exam';

type Chat = ReturnType<typeof useSolverChat>;

/** Step 4: the step-by-step conversation, with the question and the concept cards beside it. */
export function SolverChat({ onAskNew, onAskAtlas }: { onAskNew: () => void; onAskAtlas: () => void }) {
  const exam = useExam();
  const chat = useSolverChat(exam);
  const { problem } = useSolver();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.thinking]);
  const display = problem?.display ?? '';

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-2.5 md:hidden">
        <ConceptDeck chat={chat} variant="strip" onAskNew={onAskNew} onAskAtlas={onAskAtlas} />
        <ProblemCard problem={display} sources={chat.sources} variant="bar" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
            {chat.planning ? (
              <Planning cards={chat.cards} />
            ) : (
              <ol aria-label="Conversation" className="flex flex-col gap-4">
                {chat.messages.map((message) => (
                  <li key={message.id}>
                    <Bubble message={message} onRetry={chat.canRetry(message.retryFor ?? message.id) ? () => chat.retry(message.retryFor ?? message.id) : undefined} />
                  </li>
                ))}
                {chat.thinking && (
                  <li className="flex items-start gap-2.5">
                    <Image src={SOCRATES_IMAGE} alt="" width={32} height={32} className="bg-socrates-chip size-8 rounded-full object-cover object-top" />
                    <div className="border-socrates-line bg-surface rounded-lg rounded-tl-[4px] border px-4 py-3">
                      <TypingDots label="Socrates is thinking" />
                    </div>
                  </li>
                )}
                {chat.solved && (
                  <li className="bg-success-50 text-success-700 rounded-lg px-4 py-3 text-center text-[13px] font-semibold">
                    You solved it! Ready for the next one?{' '}
                    <button type="button" onClick={onAskNew} className="underline">
                      Ask a new question
                    </button>
                  </li>
                )}
                <div ref={bottom} />
              </ol>
            )}
          </div>
          <div className="shrink-0 px-3 pt-1 pb-3 md:px-6 md:pb-4">
            {chat.offline && (
              <p role="status" className="bg-socrates-ink text-on-brand mx-auto mb-2 w-fit rounded-full px-3.5 py-1.5 text-[12px] font-medium">
                You&apos;re offline. Check your connection.
              </p>
            )}
            <Composer placeholder="Type your answer" onSend={chat.send} disabled={chat.thinking} imageOnly={false} />
          </div>
        </div>
        <aside className="bg-surface border-socrates-divider hidden w-[400px] shrink-0 flex-col gap-3 overflow-y-auto border-l p-3.5 md:flex lg:w-[460px]">
          <ProblemCard problem={display} sources={chat.sources} variant="card" />
          <ConceptDeck chat={chat} variant="panel" onAskNew={onAskNew} onAskAtlas={onAskAtlas} />
        </aside>
      </div>
    </>
  );
}

function Bubble({ message, onRetry }: { message: ChatEntry; onRetry?: () => void }) {
  if (message.fromStudent) {
    return (
      <div className={cx('flex flex-col items-end gap-1', message.failed && 'opacity-60')}>
        {message.images.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="Question diagram" className="max-h-40 max-w-[60%] rounded-md object-contain" />
        ))}
        <div className="from-brand-450 to-brand text-on-brand shadow-socrates-bubble max-w-[85%] rounded-lg rounded-tr-[4px] bg-linear-to-r px-4 py-2.5 text-[14px] leading-[21px]">
          <ChatText text={message.text} />
        </div>
        {message.failed && onRetry && (
          <button type="button" onClick={onRetry} className="text-socrates-error text-[11.5px] font-medium">
            Not sent. Tap to retry
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <Image src={SOCRATES_IMAGE} alt="" width={32} height={32} className="bg-socrates-chip size-8 shrink-0 rounded-full object-cover object-top" />
      {message.error ? (
        <div role="alert" className="border-socrates-line bg-surface flex flex-col items-start gap-2 rounded-lg rounded-tl-[4px] border px-4 py-3">
          <p className="text-socrates-text text-[13.5px] font-semibold">Couldn&apos;t reply</p>
          <p className="text-socrates-muted text-[12.5px]">Something went wrong on our side.</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="text-brand flex items-center gap-1 text-[12.5px] font-semibold">
              <RotateCw aria-hidden className="size-3.5" /> Try again
            </button>
          )}
        </div>
      ) : (
        <div className="border-socrates-line bg-surface text-socrates-body max-w-[85%] min-w-0 rounded-lg rounded-tl-[4px] border px-4 py-3 text-[14px] leading-[21px]">
          {message.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src.startsWith('http') || src.startsWith('data:') ? src : `data:image/png;base64,${src}`} alt="Diagram" className="mb-2 max-h-56 rounded-sm object-contain" />
          ))}
          <ChatText text={message.text} />
        </div>
      )}
    </div>
  );
}

const PLANNING_STEPS = ['Reading your question', 'Spotting the concept', 'Breaking it into steps'];

function Planning({ cards }: { cards: ConceptCard[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, PLANNING_STEPS.length - 1)), 1600);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="status" aria-label="Socrates is planning" className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Image src={SOCRATES_IMAGE} alt="" width={72} height={72} className="bg-socrates-chip size-[72px] animate-pulse rounded-full object-cover object-top" />
      <ol className="mt-5 flex flex-col gap-2">
        {PLANNING_STEPS.map((label, i) => (
          <li key={label} className={cx('text-[14px]', i <= step ? 'text-socrates-ink font-semibold' : 'text-socrates-faint')}>
            {label}
            {i === step ? '…' : ''}
          </li>
        ))}
      </ol>
      {cards.length > 0 && <p className="text-socrates-muted mt-4 text-[12px]">{cards.length} concepts ready</p>}
      <p className="bg-socrates-chip text-brand mt-6 rounded-full px-3 py-1 text-[11px] font-semibold">TIP · Answer in your own words. Socrates guides, you solve.</p>
    </div>
  );
}

function sourceLine(sources: Sources | null) {
  if (!sources) return null;
  return [sources.subject, sources.className, sources.chapter].filter(Boolean).join(' · ') || null;
}

function ProblemCard({ problem, sources, variant }: { problem: string; sources: Sources | null; variant: 'card' | 'bar' }) {
  const [open, setOpen] = useState(false);
  const line = sourceLine(sources);
  if (variant === 'bar') {
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="border-socrates-line bg-surface flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left"
      >
        <span className="text-brand text-[13px] font-bold">Q.</span>
        <span className={cx('text-socrates-text min-w-0 flex-1 text-[13px] leading-5', !open && 'line-clamp-1')}>
          <ChatText text={problem} />
        </span>
        {open ? <ChevronUp aria-hidden className="text-brand mt-0.5 size-4" /> : <ChevronDown aria-hidden className="text-brand mt-0.5 size-4" />}
      </button>
    );
  }
  const long = problem.length > 220;
  return (
    <section aria-label="Your question" className="border-socrates-line rounded-md border px-3 py-2.5">
      <div className="flex gap-1.5 text-[13.5px] leading-5">
        <span className="text-brand font-bold">Q.</span>
        <div className={cx('text-socrates-text min-w-0 flex-1', long && !open && 'line-clamp-4')}>
          <ChatText text={problem} />
        </div>
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="text-brand mt-1 text-[11.5px] font-semibold">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
      {line && <p className="text-socrates-faint mt-1 text-[11px]">{line}</p>}
    </section>
  );
}

function ConceptDeck({ chat, variant, onAskNew, onAskAtlas }: { chat: Chat; variant: 'strip' | 'panel'; onAskNew: () => void; onAskAtlas: () => void }) {
  const { cards, cardsLoaded, cardsUnavailable, unlockedUpTo, openCard, setOpenCard, unlock } = chat;
  const next = cards.find((c) => c.cardNo > unlockedUpTo);
  const placeholders = cardsLoaded ? cards : [1, 2, 3].map((n) => ({ cardNo: n, title: '', explanation: '', image: null }));

  if (cardsUnavailable) {
    return (
      <section className="from-brand-400 to-brand-600 text-on-brand rounded-[22px] bg-linear-to-b p-4">
        <p className="text-[14px] font-semibold">Concept cards can&apos;t be generated</p>
        <p className="text-on-brand/80 mt-1 text-[12px]">The question might be too simple or invalid.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onAskNew} className="bg-surface text-brand rounded-full px-3 py-1.5 text-[12px] font-semibold">
            Ask a new question
          </button>
          <button type="button" onClick={onAskAtlas} className="border-on-brand/60 rounded-full border px-3 py-1.5 text-[12px] font-semibold">
            Ask Atlas instead
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Concept cards"
      className={cx('from-brand-400 to-brand-450 bg-linear-to-b', variant === 'panel' ? 'rounded-[22px] p-3 pb-7' : 'rounded-t-[22px] px-3.5 pt-3 pb-0')}
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-3">
        <p className="text-on-brand text-[12px] md:text-[11.5px]">{cardsLoaded ? 'Tap the concept cards for help' : 'Breaking it into steps...'}</p>
        {variant === 'panel' && cardsLoaded && (
          <button
            type="button"
            disabled={!next}
            onClick={() => next && unlock(next.cardNo)}
            className="border-on-brand/70 text-on-brand flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50"
          >
            <Lightbulb aria-hidden className="size-3" /> Hint
          </button>
        )}
      </div>
      <ol className={cx(variant === 'panel' ? 'flex flex-col' : 'grid grid-cols-3 gap-0')}>
        {placeholders.map((card) => {
          const unlocked = cardsLoaded && card.cardNo <= unlockedUpTo;
          const open = openCard === card.cardNo;
          return (
            <li key={card.cardNo} className={cx(variant === 'panel' && card.cardNo > 1 && '-mt-1')}>
              <button
                type="button"
                disabled={!cardsLoaded}
                aria-expanded={unlocked ? open : undefined}
                aria-label={unlocked ? `Concept ${card.cardNo}: ${card.title}` : `Concept ${card.cardNo} (locked)`}
                onClick={() => (unlocked ? setOpenCard(open ? null : card.cardNo) : unlock(card.cardNo))}
                className={cx(
                  'bg-surface w-full text-left',
                  variant === 'panel' ? 'shadow-socrates-bubble rounded-lg px-4 py-3.5' : 'rounded-t-lg border-x border-t border-socrates-line px-2.5 pt-3 pb-2',
                  !unlocked && variant === 'panel' && 'bg-socrates-soft',
                )}
              >
                <span className={cx('flex items-center gap-2 text-[13px] font-semibold', unlocked ? 'text-brand' : 'text-socrates-faint')}>
                  Concept {card.cardNo}
                  {cardsLoaded && !unlocked && <Lock aria-hidden className="size-3" />}
                  {!cardsLoaded && <span className="bg-socrates-chip h-3.5 w-12 animate-pulse rounded-full" />}
                </span>
                {unlocked ? (
                  <>
                    <span className="text-socrates-ink mt-2 block font-serif text-[15px] leading-5 font-semibold">{card.title}</span>
                    {open && (
                      <span className="text-socrates-body mt-2 block text-[13px] leading-5">
                        <ChatText text={card.explanation} />
                      </span>
                    )}
                  </>
                ) : (
                  <span aria-hidden className="mt-3 flex flex-col gap-1.5">
                    <span className="bg-socrates-chip h-1.5 w-[85%] rounded-full" />
                    <span className="bg-socrates-chip h-1.5 w-[65%] rounded-full" />
                    <span className="bg-socrates-chip h-1.5 w-[45%] rounded-full" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
