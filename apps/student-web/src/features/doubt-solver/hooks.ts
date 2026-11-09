'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { ApiError } from '@/shared/lib/errors';
import { buildSolvePayload, solverApi, type BankTab, type ConceptCard, type SolverMessage, type Sources, type TutorRequest } from './api';
import { useSolver } from './store';

export const solverKeys = {
  books: (exam: string, classId: number | null) => ['doubt-solver', exam, 'books', classId] as const,
  chapters: (bookId: number) => ['doubt-solver', 'chapters', bookId] as const,
  bank: (chapterId: number, tab: BankTab) => ['doubt-solver', 'bank', chapterId, tab] as const,
  history: (classId: number | null) => ['doubt-solver', 'history', classId] as const,
};

export function useBooks(exam: ExamConfig) {
  const plan = useActivePlan(exam);
  const classId = plan.data?.classId ?? null;
  return useQuery({
    queryKey: solverKeys.books(exam.slug, classId),
    queryFn: () => solverApi.books(exam, classId),
    enabled: exam.category === 'competitive' || classId !== null,
    staleTime: 30 * 60_000,
  });
}

export function useChapters(bookId: number | null) {
  return useQuery({
    queryKey: solverKeys.chapters(bookId ?? 0),
    queryFn: () => solverApi.chapters(bookId as number),
    enabled: !!bookId,
    staleTime: 30 * 60_000,
  });
}

export function useBankQuestions(chapterId: number | null, tab: BankTab) {
  return useQuery({
    queryKey: solverKeys.bank(chapterId ?? 0, tab),
    queryFn: () => solverApi.bankQuestions(chapterId as number, tab),
    enabled: !!chapterId,
    staleTime: 10 * 60_000,
  });
}

export function useDoubtHistory(exam: ExamConfig, enabled: boolean) {
  const plan = useActivePlan(exam);
  const classId = plan.data?.classId ?? null;
  return useQuery({
    queryKey: solverKeys.history(classId),
    queryFn: () => solverApi.history(classId as number),
    enabled: enabled && classId !== null,
  });
}

/**
 * Hands a question to Socrates from another page (chapter PYQs, NCERT questions) and opens the chat,
 * as the previous app's "Solve step by step" did.
 */
export function useSolveQuestion(exam: ExamConfig) {
  const router = useRouter();
  const plan = useActivePlan(exam);
  return useCallback(
    (question: Parameters<typeof buildSolvePayload>[0], subjectName?: string | null) => {
      useSolver
        .getState()
        .solve(buildSolvePayload(question), subjectName ? { id: 0, title: subjectName.toUpperCase() } : undefined, plan.data?.className ?? null);
      router.push(routes.doubtSolverStep(exam.slug, 'chat'));
    },
    [exam.slug, plan.data?.className, router],
  );
}

export interface ChatEntry extends SolverMessage {
  /** Student message that couldn't be sent (offline): "Not sent. Tap to retry". */
  failed?: boolean;
  /** Socrates' "Couldn't reply" card; `retryFor` is the student message it belongs to. */
  error?: boolean;
  retryFor?: string;
}

const isOffline = (error: unknown) =>
  (typeof navigator !== 'undefined' && !navigator.onLine) || (error instanceof ApiError && error.status === 0);

let entryId = 0;
const newId = () => `m-${Date.now()}-${(entryId += 1)}`;

/**
 * The step-by-step conversation for the store's current question: starts it (or reloads a past doubt),
 * sends answers, loads the concept cards and tracks which card the tutor is on.
 */
export function useSolverChat(exam: ExamConfig) {
  const plan = useActivePlan(exam);
  const { problem, subject, className, chatId: storedChatId, setChatId, clearProblem } = useSolver();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [thinking, setThinking] = useState(false);
  const [cards, setCards] = useState<ConceptCard[]>([]);
  const [sources, setSources] = useState<Sources | null>(null);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [unlockedUpTo, setUnlockedUpTo] = useState(1);
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [offline, setOffline] = useState(false);
  const chatIdRef = useRef<number | null>(storedChatId);
  const retries = useRef(new Map<string, Omit<TutorRequest, 'chatId'>>());
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const classNameToSend = className ?? plan.data?.className ?? null;

  const loadCards = useCallback(
    async (request: TutorRequest) => {
      try {
        const result = await solverApi.conceptCards(request);
        if (!mounted.current || chatIdRef.current !== request.chatId) return;
        setCards(result.cards);
        setSources(result.sources);
      } catch {
        // No cards: the deck shows "Concept cards can't be generated".
      } finally {
        if (mounted.current) setCardsLoaded(true);
      }
    },
    [],
  );

  const ensureChat = useCallback(async () => {
    if (chatIdRef.current) return chatIdRef.current;
    const id = await solverApi.createChat({ subjectId: subject?.id || null, classId: plan.data?.classId ?? null, examId: exam.examId });
    chatIdRef.current = id;
    setChatId(id);
    return id;
  }, [subject?.id, plan.data?.classId, exam.examId, setChatId]);

  const turn = useCallback(
    async (request: Omit<TutorRequest, 'chatId'>, messageId: string) => {
      setThinking(true);
      try {
        const isNew = !chatIdRef.current;
        const chatId = await ensureChat();
        if (isNew) void loadCards({ ...request, chatId });
        const reply = await solverApi.ask({ ...request, chatId });
        if (!mounted.current || chatIdRef.current !== chatId) return;
        setMessages((list) => [...list, { id: newId(), fromStudent: false, text: reply.text, images: reply.image ? [reply.image] : [] }]);
        if (reply.cardNo !== null) {
          setUnlockedUpTo((n) => Math.max(n, reply.cardNo as number));
          if (!reply.isFirst) setOpenCard(reply.cardNo);
        }
        if (reply.solved) setSolved(true);
      } catch (error) {
        if (!mounted.current) return;
        if (error instanceof ApiError && error.isRateLimited) {
          // The limit dialog explains it; a question that never started goes back to asking.
          if (!chatIdRef.current) clearProblem();
          return;
        }
        if (isOffline(error)) {
          setOffline(true);
          setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, failed: true } : m)));
        } else {
          setMessages((list) => [...list, { id: newId(), fromStudent: false, text: '', images: [], error: true, retryFor: messageId }]);
        }
      } finally {
        if (mounted.current) setThinking(false);
      }
    },
    [ensureChat, loadCards, clearProblem],
  );

  // Start the question, or reload a past doubt.
  useEffect(() => {
    if (started.current || !problem || !plan.isFetched) return;
    started.current = true;
    if (storedChatId) {
      chatIdRef.current = storedChatId;
      void solverApi
        .messages(storedChatId)
        .then((rows) => mounted.current && setMessages(rows))
        .catch(() => undefined);
      void loadCards({ chatId: storedChatId, text: problem.problem, className: classNameToSend, subject });
      return;
    }
    const id = newId();
    setMessages([{ id, fromStudent: true, text: problem.display, images: problem.images }]);
    const online = problem.images.filter((src) => /^https?:\/\//i.test(src));
    const request = problem.imagesRead
      ? { text: problem.problem, className: classNameToSend, subject, attachedImageUrls: online }
      : { text: problem.problem, className: classNameToSend, subject, imageUrls: online };
    retries.current.set(id, request);
    void turn(request, id);
  }, [problem, storedChatId, plan.isFetched, classNameToSend, subject, turn, loadCards]);

  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => setOffline(false);
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => {
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
    };
  }, []);

  const send = (text: string, image: File | null) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const id = newId();
    setMessages((list) => [...list, { id, fromStudent: true, text: trimmed, images: image ? [URL.createObjectURL(image)] : [] }]);
    const request = { text: trimmed, className: classNameToSend, subject, images: image ? [image] : undefined };
    retries.current.set(id, request);
    void turn(request, id);
  };

  const retry = (messageId: string) => {
    const request = retries.current.get(messageId);
    if (!request || thinking) return;
    setOffline(false);
    setMessages((list) => list.filter((m) => !(m.error && m.retryFor === messageId)).map((m) => (m.id === messageId ? { ...m, failed: false } : m)));
    void turn(request, messageId);
  };

  const unlock = (cardNo: number) => {
    setUnlockedUpTo((n) => Math.max(n, cardNo));
    setOpenCard(cardNo);
  };

  const hasReply = messages.some((m) => !m.fromStudent);
  return {
    messages,
    thinking,
    /** Before Socrates' first reply: the "planning" screen. */
    planning: !hasReply && !messages.some((m) => m.failed || m.error),
    cards,
    sources,
    cardsLoaded,
    cardsUnavailable: cardsLoaded && cards.length === 0,
    unlockedUpTo,
    openCard,
    setOpenCard,
    unlock,
    solved,
    offline,
    send,
    retry,
    canRetry: (messageId: string) => retries.current.has(messageId),
  };
}
