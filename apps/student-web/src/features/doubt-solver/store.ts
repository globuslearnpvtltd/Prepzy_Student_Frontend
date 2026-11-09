import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SolvePayload, SolverBook, SolverSubject } from './api';

interface SolverState {
  subject: SolverSubject | null;
  book: Pick<SolverBook, 'bookId' | 'title' | 'image' | 'className'> | null;
  /** The question being solved; null until the student asks one. */
  problem: SolvePayload | null;
  /** Solver chat id once created (or picked from history). */
  chatId: number | null;
  /** Class sent to the tutor (`class_name`); the plan's class unless the question came from elsewhere. */
  className: string | null;
  chooseBook: (book: SolverBook) => void;
  clearBook: () => void;
  /** Starts solving a new question (clears any previous chat). */
  solve: (problem: SolvePayload, subject?: SolverSubject | null, className?: string | null) => void;
  /** Re-opens a past doubt. */
  resume: (chatId: number, problem: SolvePayload, subject: SolverSubject | null) => void;
  setChatId: (chatId: number) => void;
  /** Back to asking: drops the question and chat, keeps the subject. */
  clearProblem: () => void;
  reset: () => void;
}

/**
 * The solver's selection and current question. Kept in sessionStorage (as before) so a refresh keeps the
 * conversation and other pages (chapter PYQs, NCERT questions) can hand a question over.
 */
export const useSolver = create<SolverState>()(
  persist(
    (set) => ({
      subject: null,
      book: null,
      problem: null,
      chatId: null,
      className: null,
      chooseBook: (book) =>
        set({
          subject: { id: book.subjectId, title: book.subjectName.toUpperCase() },
          book: { bookId: book.bookId, title: book.title, image: book.image, className: book.className },
        }),
      clearBook: () => set({ subject: null, book: null }),
      solve: (problem, subject, className) =>
        set((state) => ({
          problem,
          chatId: null,
          subject: subject === undefined ? state.subject : subject,
          className: className === undefined ? state.className : className,
        })),
      resume: (chatId, problem, subject) => set((state) => ({ chatId, problem, subject: subject ?? state.subject, book: subject && subject.id !== state.subject?.id ? null : state.book })),
      setChatId: (chatId) => set({ chatId }),
      clearProblem: () => set({ problem: null, chatId: null }),
      reset: () => set({ subject: null, book: null, problem: null, chatId: null }),
    }),
    { name: 'prepzy-doubt-solver', storage: createJSONStorage(() => sessionStorage) },
  ),
);
