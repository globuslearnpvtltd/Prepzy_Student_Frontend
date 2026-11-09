'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { assistantApi, reviewApi, type AtlasSurface, type ChatMessage, type ReviewContext } from './api';

const surfaceKey = (surface: AtlasSurface) => (surface.kind === 'lecture' ? `lecture-${surface.courseId}` : 'dashboard');

export const atlasKeys = {
  all: ['atlas'] as const,
  conversation: (exam: string, surface: AtlasSurface) => ['atlas', exam, surfaceKey(surface), 'conversation'] as const,
  history: (exam: string, surface: AtlasSurface) => ['atlas', exam, surfaceKey(surface), 'history'] as const,
  avatar: (exam: string, surface: AtlasSurface) => ['atlas', exam, surfaceKey(surface), 'avatar'] as const,
};

let pendingId = 0;
const studentMessage = (text: string, image: string | null): ChatMessage => ({
  id: `pending-${(pendingId += 1)}`,
  fromStudent: true,
  text,
  image,
  textbookImage: null,
  sources: null,
  createdAt: new Date().toISOString(),
});

/**
 * One Atlas conversation (dashboard or lecture): loads the latest chat, sends questions, switches to a chat
 * from history and starts new chats. Replies arrive as one JSON answer (the Atlas endpoints don't stream).
 */
export function useAtlasChat(exam: ExamConfig, surface: AtlasSurface, enabled = true) {
  const queryClient = useQueryClient();
  const plan = useActivePlan(exam);
  const [chatId, setChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  const conversation = useQuery({
    queryKey: atlasKeys.conversation(exam.slug, surface),
    queryFn: () => assistantApi.conversation(exam.category, surface),
    enabled,
    staleTime: Infinity,
  });
  const avatar = useQuery({
    queryKey: atlasKeys.avatar(exam.slug, surface),
    queryFn: () => assistantApi.avatar(exam.category, surface),
    enabled,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!conversation.data || loadedRef.current) return;
    loadedRef.current = true;
    setChatId(conversation.data.chatId);
    setMessages(conversation.data.messages);
  }, [conversation.data]);

  const refreshHistory = useCallback(
    () => queryClient.invalidateQueries({ queryKey: atlasKeys.history(exam.slug, surface) }),
    [queryClient, exam.slug, surface],
  );

  const send = useMutation({
    mutationFn: ({ text, image }: { text: string; image: File | null }) =>
      assistantApi.send(exam.category, surface, {
        text,
        image,
        chatId,
        classId: plan.data?.classId,
        className: plan.data?.className,
        avatarName: avatar.data?.name,
      }),
    onMutate: ({ text, image }) => {
      setFailed(false);
      setFollowups([]);
      setMessages((list) => [...list, studentMessage(text, image ? URL.createObjectURL(image) : null)]);
    },
    onSuccess: (answer) => {
      setMessages((list) => [...list, answer.message]);
      setFollowups(answer.followups);
      void refreshHistory();
    },
    onError: () => setFailed(true),
  });

  const openChat = useMutation({
    mutationFn: (id: number) => assistantApi.messages(exam.category, surface, id),
    onSuccess: (list, id) => {
      setChatId(id);
      setMessages(list);
      setFollowups([]);
      setFailed(false);
    },
    onError: () => setFailed(true),
  });

  /** Re-reads a chat from the server (e.g. after a live talk was saved into it). */
  const reload = useMutation({
    mutationFn: (id: number) => assistantApi.messages(exam.category, surface, id),
    onSuccess: (list, id) => {
      setChatId(id);
      setMessages(list);
      void refreshHistory();
    },
  });

  const newChat = useMutation({
    mutationFn: () => assistantApi.newChat(exam.category, surface),
    onSuccess: (id) => {
      setChatId(id);
      setMessages([]);
      setFollowups([]);
      setFailed(false);
      void refreshHistory();
    },
    onError: () => setFailed(true),
  });

  return {
    chatId,
    messages,
    followups,
    avatar: avatar.data ?? null,
    avatarPending: avatar.isPending && enabled,
    loading: conversation.isPending && enabled,
    loadError: conversation.isError,
    failed,
    thinking: send.isPending,
    busy: send.isPending || openChat.isPending || newChat.isPending,
    send: (text: string, image: File | null = null) => {
      const trimmed = text.trim();
      if ((!trimmed && !image) || send.isPending) return;
      send.mutate({ text: trimmed, image });
    },
    openChat: (id: number) => {
      if (id !== chatId) openChat.mutate(id);
    },
    newChat: () => newChat.mutate(),
    reload: reload.mutateAsync,
    retry: () => void conversation.refetch(),
  };
}

export function useAtlasHistory(exam: ExamConfig, surface: AtlasSurface, enabled: boolean) {
  return useQuery({
    queryKey: atlasKeys.history(exam.slug, surface),
    queryFn: () => assistantApi.history(exam.category, surface),
    enabled,
  });
}

/** Read-aloud of one answer; only one plays at a time. */
export function useReadAloud() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  }, []);
  useEffect(() => stop, [stop]);

  const play = useCallback(
    async (id: string, text: string) => {
      stop();
      setLoading(id);
      try {
        const blob = await assistantApi.speech(text);
        const player = new Audio(URL.createObjectURL(blob));
        player.onended = () => setPlaying(null);
        audio.current = player;
        setPlaying(id);
        await player.play();
      } catch {
        setPlaying(null);
      } finally {
        setLoading(null);
      }
    },
    [stop],
  );
  return { playing, loading, play, stop };
}

export interface ReviewMessage {
  id: string;
  fromStudent: boolean;
  text: string;
  /** Photo the student attached, or a figure from a live talk. */
  image?: string | null;
  error?: boolean;
}

/** Post-submission chat about one question: history, then streamed replies. */
export function useReviewChat(exam: ExamConfig, ctx: ReviewContext, enabled: boolean) {
  const [messages, setMessages] = useState<ReviewMessage[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const history = useQuery({
    queryKey: ['atlas', exam.slug, 'review', ctx.assessmentId, ctx.questionId, ctx.attemptId, ctx.subQuestionId ?? null],
    queryFn: () => reviewApi.history(exam.category, ctx),
    enabled,
  });
  useEffect(() => {
    if (history.data) setMessages(history.data.map((m) => ({ id: m.id, fromStudent: m.fromStudent, text: m.text, image: m.image })));
  }, [history.data]);
  useEffect(() => () => abort.current?.abort(), []);

  const ask = useCallback(
    async (text: string, image: File | null = null) => {
      const trimmed = text.trim();
      if ((!trimmed && !image) || streaming) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const replyId = `reply-${Date.now()}`;
      setFollowups([]);
      setStreaming(true);
      setMessages((list) => [
        ...list,
        { id: `ask-${Date.now()}`, fromStudent: true, text: trimmed, image: image ? URL.createObjectURL(image) : null },
        { id: replyId, fromStudent: false, text: '' },
      ]);
      const update = (patch: Partial<ReviewMessage>) =>
        setMessages((list) => list.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));
      try {
        const reply = await reviewApi.ask(exam.category, ctx, trimmed, (partial) => update({ text: partial }), controller.signal, image);
        setFollowups(reply.followups);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        update({ text: 'Sorry, something went wrong. Please try again.', error: true });
      } finally {
        if (abort.current === controller) setStreaming(false);
      }
    },
    [exam.category, ctx, streaming],
  );

  /** Puts a finished live talk's turns into the thread (the save to the server runs in the background). */
  const appendTurns = useCallback((turns: { role: 'user' | 'assistant'; text: string; image?: string | null }[]) => {
    const stamp = Date.now();
    setMessages((list) => [...list, ...turns.map((turn, i) => ({ id: `voice-${stamp}-${i}`, fromStudent: turn.role === 'user', text: turn.text, image: turn.image ?? null }))]);
    setFollowups([]);
  }, []);

  return { messages, followups, streaming, loading: history.isPending && enabled, ask, appendTurns, stop: () => abort.current?.abort() };
}
