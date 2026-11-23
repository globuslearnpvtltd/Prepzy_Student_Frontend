import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePlanSelection } from '@/features/auth';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { apiClient } from '@/shared/lib/api-client';
import { isFeatureRestricted } from '@/shared/lib/errors';
import { testExam } from '@/test/exams';
import { accessClassId, restrictFeatures } from '@/test/feature-access';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import {
  assessmentFeature,
  featureAccessApi,
  RESTRICTABLE_FEATURES,
  TEST_TYPE_FEATURE,
  toRestricted,
  useFeatureAccess,
  useFeatureGuard,
  useFeatureRestrictedDialog,
} from '.';
import { FeatureDisabledScreen, FeatureLock, FeatureRestrictedDialog, FeatureRouteGate } from './ui';

const cbse = testExam('cbse');
const restrictedBody = { success: false, code: 'FEATURE_RESTRICTED', message: 'Not enabled', data: null, details: { feature: 'search' } };

beforeEach(() => {
  useFeatureRestrictedDialog.setState({ open: false, feature: null });
  navigation.pathname = '/';
});

function wrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ExamProvider value={cbse}>{children}</ExamProvider>
      </QueryClientProvider>
    );
  };
}

describe('feature catalog and api', () => {
  it('has the backend keys', () => {
    expect(RESTRICTABLE_FEATURES).toEqual([
      'video_lectures', 'notes', 'summary_videos', 'quiz', 'unit_test', 'mid_term', 'final_exam', 'mock_exam',
      'pyq_exam', 'chapter_pyq', 'custom_exam', 'practice_dpp', 'chapter_practice', 'diagnostic_test', 'study_plan',
      'atlas_chat', 'lecture_chat', 'review_chat', 'doubt_solver', 'pyq_trends', 'syllabus', 'search',
    ]);
    expect(TEST_TYPE_FEATURE.quiz).toEqual(['quiz', 'unit_test']);
    expect(assessmentFeature('unit_test')).toBe('unit_test');
    expect(assessmentFeature('mid_term_exam')).toBe('mid_term');
    expect(assessmentFeature('other')).toBeNull();
    expect(assessmentFeature(null)).toBeNull();
  });

  it('keeps known keys only, once', () => {
    expect(toRestricted({ restricted: ['notes', 'notes', 'future_key', 3, 'search'] })).toEqual(['notes', 'search']);
    expect(toRestricted({})).toEqual([]);
    expect(toRestricted(null)).toEqual([]);
  });

  it('reads the exam’s restrictions', async () => {
    let url = '';
    server.use(
      http.get(`${API}/api/v4/feature-access/:category/:examId`, ({ request }) => {
        url = new URL(request.url).pathname;
        return HttpResponse.json({ success: true, data: { restricted: ['mock_exam'] } });
      }),
    );
    await expect(featureAccessApi.restricted(cbse)).resolves.toEqual(['mock_exam']);
    expect(url).toBe('/api/v4/feature-access/board/1');
  });

  it('sends the class as class_id, and no param without one', async () => {
    const searches: string[] = [];
    server.use(
      http.get(`${API}/api/v4/feature-access/:category/:examId`, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json({ success: true, data: { restricted: [] } });
      }),
    );
    await featureAccessApi.restricted(cbse, 12);
    await featureAccessApi.restricted(cbse, null);
    await featureAccessApi.restricted(cbse);
    expect(searches).toEqual(['?class_id=12', '', '']);
  });
});

describe('useFeatureAccess', () => {
  it('locks nothing while loading, then the restricted keys (a list only when all are restricted)', async () => {
    server.use(
      http.get(`${API}/api/v4/feature-access/:category/:examId`, async () => {
        await delay(20);
        return HttpResponse.json({ success: true, data: { restricted: ['quiz', 'notes'] } });
      }),
    );
    const { result } = renderHook(() => useFeatureAccess(), { wrapper: wrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRestricted('notes')).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRestricted('notes')).toBe(true);
    expect(result.current.isRestricted(['quiz', 'unit_test'])).toBe(false);
    expect(result.current.isRestricted(['quiz', 'notes'])).toBe(true);
    expect(result.current.isRestricted([])).toBe(false);
    expect(result.current.restricted).toEqual(['quiz', 'notes']);
  });

  it('treats a failed access query as nothing restricted', async () => {
    server.use(http.get(`${API}/api/v4/feature-access/:category/:examId`, () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHook(() => useFeatureAccess(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRestricted('notes')).toBe(false);
  });

  it('asks nothing outside an exam', () => {
    const { result } = renderHook(() => useFeatureAccess(null), { wrapper: wrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRestricted('search')).toBe(false);
  });

  describe('per class (the goal switcher’s plan)', () => {
    const plan = (planId: number, classId: number) => ({
      plan_id: planId, exam_id: 1, class_id: classId, class_name: `CLASS ${classId}`, stream_name: '',
      duration_months: 12, expiry_date: '2027-05-01', status: 'active',
    });
    const plansHandler = (plans: unknown[], wait = 0) =>
      http.get(`${API}/api/v4/student/plans/active`, async () => {
        if (wait) await delay(wait);
        return HttpResponse.json({ success: true, data: { plans } });
      });

    beforeEach(() => usePlanSelection.setState({ planId: null }));
    afterEach(() => {
      usePlanSelection.setState({ planId: null });
      localStorage.clear();
    });

    it('sends the class on screen and updates the locks when the goal switcher changes class', async () => {
      const sent: (number | null)[] = [];
      server.use(
        plansHandler([plan(7, 20), plan(8, 10)]),
        http.get(`${API}/api/v4/feature-access/:category/:examId`, ({ request }) => {
          const classId = accessClassId(request);
          sent.push(classId);
          return HttpResponse.json({ success: true, data: { restricted: classId === 20 ? ['notes', 'quiz'] : [] } });
        }),
      );
      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useFeatureAccess(), { wrapper: wrapper(queryClient) });
      await waitFor(() => expect(result.current.isRestricted('notes')).toBe(true));
      expect(sent.at(-1)).toBe(20);
      expect(queryClient.getQueryData(['feature-access', 1, 20])).toEqual(['notes', 'quiz']);

      // The student picks Class 10 in the goal switcher: its own list (nothing restricted) replaces the NEET one.
      act(() => usePlanSelection.getState().select(8));
      await waitFor(() => expect(result.current.isRestricted('notes')).toBe(false));
      expect(sent.at(-1)).toBe(10);
      expect(result.current.isLoading).toBe(false);

      // Back to the restricted class: cached, locked again at once.
      act(() => usePlanSelection.getState().select(7));
      expect(result.current.isRestricted('quiz')).toBe(true);
    });

    it('keeps the previous class’s locks while the new class’s list loads (no blink)', async () => {
      server.use(
        plansHandler([plan(7, 20), plan(8, 10)]),
        http.get(`${API}/api/v4/feature-access/:category/:examId`, async ({ request }) => {
          const classId = accessClassId(request);
          if (classId === 10) await delay(30);
          return HttpResponse.json({ success: true, data: { restricted: classId === 10 ? [] : ['notes'] } });
        }),
      );
      const { result } = renderHook(() => useFeatureAccess(), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.isRestricted('notes')).toBe(true));
      act(() => usePlanSelection.getState().select(8));
      expect(result.current.isRestricted('notes')).toBe(true);
      expect(result.current.isLoading).toBe(false);
      await waitFor(() => expect(result.current.isRestricted('notes')).toBe(false));
    });

    it('asks without class_id while the plans load, and when there is no active plan', async () => {
      const sent: (number | null)[] = [];
      server.use(
        plansHandler([], 20),
        http.get(`${API}/api/v4/feature-access/:category/:examId`, ({ request }) => {
          sent.push(accessClassId(request));
          return HttpResponse.json({ success: true, data: { restricted: ['search'] } });
        }),
      );
      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useFeatureAccess(), { wrapper: wrapper(queryClient) });
      // Not blocked on the plans: the class-less list answers first.
      await waitFor(() => expect(result.current.isRestricted('search')).toBe(true));
      await waitFor(() => expect(queryClient.getQueryState(['auth', 'plans', 1])?.status).toBe('success'));
      expect(sent).toEqual([null]);
      expect(queryClient.getQueryData(['feature-access', 1, null])).toEqual(['search']);
    });
  });

  it('guards actions: runs them when allowed, else opens the dialog', async () => {
    server.use(restrictFeatures('atlas_chat'));
    const action = vi.fn();
    const { result } = renderHook(() => useFeatureGuard(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.guard('doubt_solver', action)());
    expect(action).toHaveBeenCalledTimes(1);
    act(() => result.current.guard('atlas_chat', action)());
    expect(action).toHaveBeenCalledTimes(1);
    expect(useFeatureRestrictedDialog.getState()).toMatchObject({ open: true, feature: 'atlas_chat' });
  });
});

describe('FeatureLock', () => {
  it('renders the entry point untouched when allowed', async () => {
    renderWithProviders(
      <FeatureLock feature="notes" label="Notes">
        <Link href="/cbse/notes">Notes</Link>
      </FeatureLock>,
      { exam: cbse },
    );
    expect(await screen.findByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/cbse/notes');
  });

  it('shows a padlock and opens the dialog on click or Enter, never following the link', async () => {
    server.use(restrictFeatures('notes'));
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <FeatureLock feature="notes" label="Notes">
          <Link href="/cbse/notes">Notes</Link>
        </FeatureLock>
        <FeatureRestrictedDialog />
      </>,
      { exam: cbse },
    );
    const locked = await screen.findByRole('button', { name: 'Notes (not enabled by your institute)' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAttribute('title', 'Not enabled by your institute');
    expect(screen.queryByRole('link', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Not enabled by your institute').length).toBeGreaterThan(0);

    await user.click(locked);
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      "This feature isn't enabled for your account by your institute. Please contact your institute.",
    );
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    locked.focus();
    await user.keyboard('{Enter}');
    expect(useFeatureRestrictedDialog.getState()).toMatchObject({ open: true, feature: 'notes' });
  });

  it('draws the edge badge for buttons and nothing for badge="none"', async () => {
    server.use(restrictFeatures('search', 'notes'));
    renderWithProviders(
      <>
        <FeatureLock feature="search" label="Search" badge="edge" as="span">
          <button type="button">Search</button>
        </FeatureLock>
        <FeatureLock feature="notes" label="Read" badge="none">
          <button type="button">Read</button>
        </FeatureLock>
      </>,
      { exam: cbse },
    );
    const edge = await screen.findByRole('button', { name: /^Search \(/ });
    expect(edge.tagName).toBe('SPAN');
    expect(edge.querySelector('[title="Not enabled by your institute"] svg')).not.toBeNull();
    const none = await screen.findByRole('button', { name: /^Read \(/ });
    expect(none.querySelector('svg')).toBeNull();
  });
});

describe('FeatureRestrictedDialog and the API', () => {
  it('opens on a 403 FEATURE_RESTRICTED from an action and refreshes the access list', async () => {
    let accessCalls = 0;
    server.use(
      http.get(`${API}/api/v4/feature-access/:category/:examId`, () => {
        accessCalls += 1;
        return HttpResponse.json({ success: true, data: { restricted: [] } });
      }),
      http.post(`${API}/api/v4/search/board/1/lectures`, () => HttpResponse.json(restrictedBody, { status: 403 })),
      http.get(`${API}/api/v4/study-plan/x`, () => HttpResponse.json(restrictedBody, { status: 403 })),
    );
    function AccessProbe() {
      useFeatureAccess();
      return null;
    }
    renderWithProviders(
      <>
        <AccessProbe />
        <FeatureRestrictedDialog />
      </>,
      { exam: cbse },
    );
    await waitFor(() => expect(accessCalls).toBe(1));

    // A page load (GET) only refreshes the access list.
    const loadError = await apiClient.get('/api/v4/study-plan/x').catch((e: unknown) => e);
    expect(isFeatureRestricted(loadError)).toBe(true);
    await waitFor(() => expect(accessCalls).toBe(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // An action (POST) also explains why.
    await act(() => apiClient.post('/api/v4/search/board/1/lectures', { query: 'x' }).catch(() => undefined));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Not enabled by your institute');
    expect(useFeatureRestrictedDialog.getState().feature).toBe('search');
    await waitFor(() => expect(accessCalls).toBe(3));
  });
});

describe('FeatureRouteGate and FeatureDisabledScreen', () => {
  it('shows the disabled screen on a restricted page, with a way back to the dashboard', async () => {
    server.use(restrictFeatures('mock_exam'));
    navigation.pathname = '/cbse/mock-sets/3';
    renderWithProviders(
      <FeatureRouteGate>
        <p>Mock papers</p>
      </FeatureRouteGate>,
      { exam: cbse },
    );
    expect(await screen.findByRole('heading', { name: 'Not enabled by your institute' })).toBeInTheDocument();
    expect(screen.getByText('Contact your institute to use this feature.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/cbse/dashboard');
    expect(screen.queryByText('Mock papers')).not.toBeInTheDocument();
  });

  it('waits for the access list on a feature page, then shows it when allowed', async () => {
    server.use(
      http.get(`${API}/api/v4/feature-access/:category/:examId`, async () => {
        await delay(20);
        return HttpResponse.json({ success: true, data: { restricted: ['notes'] } });
      }),
    );
    navigation.pathname = '/cbse/tests/quiz/5';
    renderWithProviders(
      <FeatureRouteGate>
        <p>Quiz</p>
      </FeatureRouteGate>,
      { exam: cbse },
    );
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument();
    expect(await screen.findByText('Quiz')).toBeInTheDocument();
  });

  it('never holds back pages that are not one feature', () => {
    navigation.pathname = '/cbse/dashboard';
    renderWithProviders(
      <FeatureRouteGate>
        <p>Dashboard</p>
      </FeatureRouteGate>,
      { exam: cbse },
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('links home outside an exam', () => {
    renderWithProviders(<FeatureDisabledScreen />);
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
  });
});
