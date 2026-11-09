'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { Drawer, HistoryList } from '@/features/assistant/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { stripDiagrams, type SolvePayload } from '../api';
import { useDoubtHistory } from '../hooks';
import { useSolver } from '../store';
import { QuestionBank } from './question-bank';
import { SolverChat } from './solver-chat';
import { DesktopBack, SolverHeader } from './solver-header';
import { AskDoubt, StartOptions } from './start-steps';
import { SubjectPicker } from './subject-picker';

export type SolverStep = 'subject' | 'start' | 'ask' | 'question-bank' | 'chat';

/** Which step to show: the URL asks for one, the stored selection decides whether it's possible. */
export function resolveStep(param: string | null, state: { hasSubject: boolean; hasBook: boolean; hasProblem: boolean }): SolverStep {
  if (param === 'question-bank' && state.hasSubject && state.hasBook) return 'question-bank';
  if (state.hasProblem) return 'chat';
  if (param === 'ask' && state.hasSubject) return 'ask';
  if (param === 'start' && state.hasSubject) return 'start';
  return 'subject';
}

function useHydrated() {
  const [hydrated, setHydrated] = useState(() => useSolver.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useSolver.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

/** Ask Socrates: subject → start options → ask / question bank → step-by-step chat, with previous doubts. */
export function DoubtSolverScreen() {
  const exam = useExam();
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const plan = useActivePlan(exam);
  const solver = useSolver();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [bankRequest, setBankRequest] = useState(0);
  const [chatKey, setChatKey] = useState(0);
  const history = useDoubtHistory(exam, historyOpen);
  const step = resolveStep(params?.get('step') ?? null, {
    hasSubject: !!solver.subject,
    hasBook: !!solver.book,
    hasProblem: !!solver.problem,
  });
  const go = (next: Exclude<SolverStep, 'subject'> | 'subject', replace = false) => {
    const url = next === 'subject' ? routes.doubtSolver(exam.slug) : routes.doubtSolverStep(exam.slug, next);
    if (replace) router.replace(url);
    else router.push(url);
  };

  useEffect(() => {
    if (step !== 'chat' && step !== 'ask') setHistoryOpen(false);
  }, [step]);

  if (!hydrated) return <div className="bg-socrates-page h-dvh" />;

  const solve = (payload: SolvePayload) => {
    solver.solve(payload, undefined, plan.data?.className ?? null);
    setChatKey((k) => k + 1);
    go('chat');
  };
  const askNew = () => {
    solver.clearProblem();
    go(solver.subject ? 'ask' : 'subject');
  };
  const newProblem = () => {
    solver.reset();
    go('subject');
  };
  const openBank = solver.book ? () => go('question-bank') : undefined;

  const historyDrawer = (
    <Drawer open={historyOpen} label="Previous doubts" onClose={() => setHistoryOpen(false)}>
      <HistoryList
        title="Previous doubts"
        newLabel="New doubt"
        emptyText="No doubts in the last 7 days."
        errorText="Couldn't load your doubts."
        items={history.data?.map(({ chatId, title, lastMessageAt }) => ({ chatId, title, lastMessageAt }))}
        loading={history.isPending}
        error={history.isError}
        activeId={step === 'chat' ? solver.chatId : null}
        onRetry={() => void history.refetch()}
        onClose={() => setHistoryOpen(false)}
        onNew={() => {
          setHistoryOpen(false);
          newProblem();
        }}
        onSelect={(chatId) => {
          setHistoryOpen(false);
          const item = history.data?.find((h) => h.chatId === chatId);
          if (!item || (chatId === solver.chatId && step === 'chat')) return;
          const display = stripDiagrams(item.firstMessage);
          solver.resume(
            chatId,
            { problem: item.firstMessage, display, images: [] },
            item.subjectId && item.subjectName ? { id: item.subjectId, title: item.subjectName.toUpperCase() } : null,
          );
          setChatKey((k) => k + 1);
          if (step !== 'chat') go('chat');
        }}
      />
    </Drawer>
  );

  if (step === 'question-bank') {
    return <QuestionBank onBack={() => router.back()} onChangeSubject={() => go('subject')} onSolve={(payload) => solve({ ...payload })} />;
  }

  if (step === 'chat') {
    return (
      <div className="bg-socrates-page flex h-dvh flex-col">
        <SolverHeader
          onBack={() => setLeaving(true)}
          showDesktopBack
          onQuestionBank={openBank}
          onNewProblem={newProblem}
          onHistory={() => setHistoryOpen(true)}
        />
        <SolverChat key={chatKey} onAskNew={askNew} onAskAtlas={() => router.push(routes.atlas(exam.slug))} />
        {historyDrawer}
        {leaving && (
          <div role="alertdialog" aria-modal="true" aria-label="Leave this problem?" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div aria-hidden className="bg-socrates-overlay/35 absolute inset-0" onClick={() => setLeaving(false)} />
            <div className="bg-surface shadow-socrates-sheet relative w-full max-w-[360px] rounded-xl p-5 text-center">
              <p className="text-socrates-ink font-serif text-[19px] font-semibold">Leave this problem?</p>
              <p className="text-socrates-muted mt-2 text-[13px]">You can find it again in Previous doubts.</p>
              <div className="mt-5 flex gap-2.5">
                <button type="button" onClick={() => setLeaving(false)} className="border-socrates-line text-brand flex-1 rounded-full border py-2 text-[14px] font-semibold">
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaving(false);
                    solver.clearProblem();
                    go(solver.subject ? 'start' : 'subject', true);
                  }}
                  className="bg-brand text-on-brand flex-1 rounded-full py-2 text-[14px] font-semibold"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'ask') {
    return (
      <div className="bg-socrates-page flex h-dvh flex-col">
        <SolverHeader onBack={() => go('start', true)} onQuestionBank={openBank} onHistory={() => setHistoryOpen(true)} />
        <DesktopBack onClick={() => go('start', true)} />
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 pt-[18vh] pb-8 md:items-center md:pt-0">
          <AskDoubt onSolve={solve} />
        </div>
        {historyDrawer}
      </div>
    );
  }

  return (
    <div className="bg-socrates-page flex h-dvh flex-col">
      <SolverHeader
        onBack={() => (step === 'start' ? go('subject', true) : router.push(routes.dashboard(exam.slug)))}
        onQuestionBank={step === 'subject' ? () => setBankRequest((n) => n + 1) : openBank}
      />
      {step === 'start' && <DesktopBack onClick={() => go('subject', true)} />}
      <div className={`flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 pb-8 md:py-10 ${step === 'subject' ? 'pt-[16vh] md:pt-10' : 'max-md:px-0 max-md:pb-0 md:pt-8'}`}>
        {step === 'subject' ? (
          <SubjectPicker onNext={() => go('start')} onQuestionBank={() => go('question-bank')} questionBankRequest={bankRequest} />
        ) : (
          <StartOptions onAsk={() => go('ask')} onQuestionBank={() => go('question-bank')} onChangeSubject={() => go('subject', true)} />
        )}
      </div>
    </div>
  );
}
