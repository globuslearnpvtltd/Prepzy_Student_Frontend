import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Flow = 'login' | 'signup';

interface OnboardingState {
  phone: string | null;
  flow: Flow | null;
  examId: number | null;
  examName: string | null;
  /** From marketing links: /get-started?class_id=…&exam=…&ref=… */
  preselectedClassId: number | null;
  preselectedExam: string | null;
  referralCode: string | null;

  startOtp: (phone: string, flow: Flow) => void;
  selectExam: (examId: number, examName: string) => void;
  setPreselection: (values: { classId?: number | null; exam?: string | null; referralCode?: string | null }) => void;
  reset: () => void;
}

const initial = {
  phone: null,
  flow: null,
  examId: null,
  examName: null,
  preselectedClassId: null,
  preselectedExam: null,
  referralCode: null,
};

/**
 * Sign-up / login progress for this tab. Replaces the old scattered localStorage/sessionStorage keys;
 * kept in sessionStorage so a refresh mid-flow works but nothing lingers after the tab closes.
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      startOtp: (phone, flow) => set({ phone, flow }),
      selectExam: (examId, examName) => set({ examId, examName }),
      setPreselection: ({ classId, exam, referralCode }) =>
        set((state) => ({
          preselectedClassId: classId ?? state.preselectedClassId,
          preselectedExam: exam ?? state.preselectedExam,
          referralCode: referralCode ?? state.referralCode,
        })),
      reset: () => set(initial),
    }),
    { name: 'prepzy-onboarding', storage: createJSONStorage(() => sessionStorage) },
  ),
);

/**
 * True once the saved progress has been read from sessionStorage. Screens that restart the flow when the
 * phone number is missing wait for this, so a refresh mid-flow doesn't bounce the student back to the start.
 */
export function useOnboardingHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) setHydrated(true);
    return useOnboardingStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
