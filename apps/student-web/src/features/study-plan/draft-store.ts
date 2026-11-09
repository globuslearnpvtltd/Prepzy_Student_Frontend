import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Chapters picked for the next study plan (was studyPlanDraftSlice), kept for the tab's session. */
export interface StudyPlanDraft {
  classId: number | null;
  moduleIds: number[];
  setDraft: (classId: number | null, moduleIds: number[]) => void;
  clear: () => void;
}

export const useStudyPlanDraft = create<StudyPlanDraft>()(
  persist(
    (set) => ({
      classId: null,
      moduleIds: [],
      setDraft: (classId, moduleIds) => set({ classId, moduleIds }),
      clear: () => set({ classId: null, moduleIds: [] }),
    }),
    { name: 'study-plan-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** The day to reopen when the student comes back from a task. */
const RETURN_KEY = 'study-plan-return';
export function saveReturnDate(date: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, date);
  } catch {
    // Storage blocked: the plan opens on today instead.
  }
}
export function takeReturnDate(): string | null {
  try {
    const date = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return date;
  } catch {
    return null;
  }
}
