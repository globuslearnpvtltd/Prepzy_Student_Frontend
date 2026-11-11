import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { usePlanSelection } from '@/features/auth';
import { apiClient } from '@/shared/lib/api-client';
import { useExam } from '@/shared/hooks/use-exam';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { remainingPercent, resolveDailyPractice } from './competitive-navigation';
import { AppChrome, ExamFrame, ReferenceFrame } from './exam-shell';
import { LimitDialog } from './limit-dialog';
import { useMobileNav } from './mobile-nav-store';
import { SectionPlaceholder } from './section-placeholder';
import { shellApi, subjectLabel } from './shell-api';
import { testExam } from '@/test/exams';

const purchased = (...exams: [string, string][]) =>
  http.get(`${API}/api/v4/student/exams/purchased`, () =>
    HttpResponse.json({
      success: true,
      data: { exams: exams.map(([slice, name], i) => ({ exam_id: i + 1, exam_slice: slice, exam_name: name })) },
    }),
  );

const account = http.get(`${API}/api/v4/student/account`, () =>
  HttpResponse.json({
    success: true,
    data: { account_id: 1, first_name: 'Asha', last_name: 'Rao', phone: '+919876543210' },
  }),
);

type RawPlan = Record<string, unknown>;
const boardPlan = (extra: RawPlan = {}): RawPlan => ({
  plan_id: 1,
  class_id: 12,
  class_name: 'CLASS 12',
  stream_name: 'PCB',
  duration_months: 12,
  expiry_date: '2027-05-01',
  status: 'active',
  ...extra,
});
const plans = (...rows: RawPlan[]) =>
  http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: rows } }));
const studyPlan = (hasPlan: boolean) =>
  http.get(`${API}/api/v4/study-plan/classes/:classId/status`, () => HttpResponse.json({ success: true, data: { has_plan: hasPlan } }));

function renderShell(slug: 'cbse' | 'neet') {
  return renderWithProviders(
    <ExamFrame examSlug={slug}>
      <AppChrome>
        <p>Page</p>
      </AppChrome>
    </ExamFrame>,
  );
}

beforeEach(() => {
  localStorage.clear();
  usePlanSelection.setState({ planId: null });
  useMobileNav.setState({ open: false });
});

describe('ExamFrame access check', () => {
  it('renders the page when the student owns the exam, with the exam theme', async () => {
    server.use(purchased(['cbse', 'CBSE']));
    const { container } = renderWithProviders(
      <ExamFrame examSlug="cbse">
        <p>Dashboard content</p>
      </ExamFrame>,
    );
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    expect(container.querySelector('[data-theme="board"]')).not.toBeNull();
    expect(document.cookie).toContain('prepzy_exam=cbse');
  });

  it('moves the student to an exam they own', async () => {
    server.use(purchased(['neet-ug', 'NEET-UG']));
    renderWithProviders(
      <ExamFrame examSlug="cbse">
        <p>Dashboard content</p>
      </ExamFrame>,
    );
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('explains when the student has no exam at all', async () => {
    server.use(purchased());
    renderWithProviders(
      <ExamFrame examSlug="neet">
        <p>Dashboard content</p>
      </ExamFrame>,
    );
    expect(await screen.findByRole('heading', { name: "NEET UG isn't on your account" })).toBeInTheDocument();
  });
});

describe('board shell', () => {
  beforeEach(() => {
    navigation.pathname = '/cbse/dashboard';
  });

  it('shows the labelled sidebar, header links and the active plan card', async () => {
    server.use(purchased(['cbse', 'CBSE']), account, plans(boardPlan()), studyPlan(false));
    renderShell('cbse');
    await screen.findByText('Page');

    const [sidebar, bottomBar] = screen.getAllByRole('navigation', { name: 'Main' });
    expect(within(sidebar!).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(await within(sidebar!).findByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/cbse/learn');
    expect(within(sidebar!).getByRole('link', { name: 'Refer & Earn' })).toHaveAttribute('href', '/cbse/refer-and-earn');
    // No study plan yet: Study Plan is locked and not a link.
    expect(within(sidebar!).queryByRole('link', { name: /Study Plan/ })).not.toBeInTheDocument();
    expect(within(sidebar!).getByText('Study Plan').closest('[aria-disabled]')).not.toBeNull();

    const header = screen.getByRole('navigation', { name: 'Header' });
    expect(within(header).getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/cbse/courses');
    expect(within(header).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    expect(await screen.findByRole('link', { name: 'Active plan: CLASS 12 (PCB) Topper. Manage' })).toHaveAttribute(
      'href',
      '/cbse/plans',
    );
    expect(screen.getByText('Expires 1 May 2027')).toBeInTheDocument();

    // Mobile bottom bar: four sections and the raised Ask button.
    expect(within(bottomBar!).getAllByRole('link').map((l) => l.textContent)).toEqual(['Dashboard', 'Learn', 'Assessments', 'Notes']);
    // The raised Ask button opens the Atlas / Socrates sheet.
    await userEvent.click(within(bottomBar!).getByRole('button', { name: 'Ask a question' }));
    expect(await screen.findByRole('dialog', { name: 'Have a Question/Problem?' })).toBeInTheDocument();
  });

  it('locks Learn, Assessments, Notes and Study Plan without a plan', async () => {
    server.use(purchased(['cbse', 'CBSE']), account, plans(), studyPlan(true));
    renderShell('cbse');
    await screen.findByText('Page');
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Main' });
    await waitFor(() => expect(within(sidebar!).getAllByLabelText('Locked')).toHaveLength(4));
    expect(within(sidebar!).queryByRole('link', { name: /Learn/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Free User').length).toBeGreaterThan(0);
  });

  it('unlocks Study Plan when the student has one', async () => {
    server.use(purchased(['cbse', 'CBSE']), account, plans(boardPlan()), studyPlan(true));
    renderShell('cbse');
    await screen.findByText('Page');
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Main' });
    expect(await within(sidebar!).findByRole('link', { name: 'Study Plan' })).toHaveAttribute('href', '/cbse/study-plan');
  });

  it('switches class from the class switcher', async () => {
    server.use(
      purchased(['cbse', 'CBSE']),
      account,
      studyPlan(false),
      plans(
        boardPlan(),
        boardPlan({ plan_id: 2, class_id: 11, class_name: 'CLASS 11', stream_name: '', duration_months: 0 }),
        boardPlan({ plan_id: 3, class_id: 10, class_name: 'CLASS 10', stream_name: '', status: 'expired' }),
      ),
    );
    renderShell('cbse');
    await userEvent.click(await screen.findByRole('button', { name: /Class: CLASS 12 \(PCB\)/ }));
    expect(await screen.findByRole('menuitem', { name: /CLASS 10/ })).toHaveAttribute('data-disabled');
    expect(screen.getByText('expired')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add New Class' })).toHaveAttribute('href', '/cbse/plans');
    await userEvent.click(screen.getByRole('menuitem', { name: /CLASS 11/ }));

    expect(localStorage.getItem('selectedPlanId')).toBe('2');
    expect(navigation.push).toHaveBeenCalledWith('/cbse/dashboard');
    expect(await screen.findByRole('button', { name: /Class: CLASS 11/ })).toBeInTheDocument();
  });

  it('opens the mobile menu drawer with the profile, class switcher and account links', async () => {
    server.use(
      purchased(['cbse', 'CBSE'], ['neet-ug', 'NEET-UG']),
      account,
      studyPlan(false),
      plans(boardPlan(), boardPlan({ plan_id: 2, class_id: 11, class_name: 'CLASS 11', stream_name: '' })),
    );
    renderShell('cbse');
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(await within(drawer).findByText('12 Months Plan')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: /Refer & Earn/ })).toHaveAttribute('href', '/cbse/refer-and-earn');
    expect(within(drawer).getByRole('link', { name: /NEET-UG/ })).toHaveAttribute('href', '/neet/dashboard');

    await userEvent.click(within(drawer).getByRole('button', { name: /CLASS 12 PCB/ }));
    await userEvent.click(within(drawer).getByRole('button', { name: /CLASS 11/ }));
    expect(localStorage.getItem('selectedPlanId')).toBe('2');
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('suggests topics while typing in the search box', async () => {
    let query = '';
    server.use(
      purchased(['cbse', 'CBSE']),
      account,
      studyPlan(false),
      plans(boardPlan()),
      http.get(`${API}/api/v1/student/search-suggestions`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          success: true,
          data: { suggestions: [{ topic_name: 'Electric Charge', subject_name: 'PHYSICS' }] },
        });
      }),
    );
    renderShell('cbse');
    await screen.findByText('Page');
    const [box] = screen.getAllByRole('combobox', { name: 'Search topics' });
    await userEvent.type(box!, 'elec');
    const suggestion = await screen.findByRole('button', { name: /electric charge/i }, { timeout: 2000 });
    expect(query).toBe('?q=elec&classId=12');
    expect(suggestion).toHaveTextContent('Physics');
    await userEvent.click(suggestion);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/learn');
  });
});

describe('competitive shell', () => {
  beforeEach(() => {
    navigation.pathname = '/neet/mock-tests';
  });

  const neetPlan = plans({
    plan_id: 5,
    exam_id: 2,
    class_id: 20,
    class_name: 'NEET',
    duration_months: 12,
    expiry_date: '2099-05-01',
    status: 'active',
    year: 2027,
    related_exams: '[1]',
  });

  it('shows the icon rail with the plan card and switches exams / logs out from the header', async () => {
    let loggedOut = false;
    server.use(
      purchased(['neet-ug', 'NEET-UG'], ['cbse', 'CBSE']),
      account,
      neetPlan,
      http.get(`${API}/api/v4/student/plans/2/summary`, () =>
        HttpResponse.json({
          success: true,
          data: { planName: 'NEET Basic', planType: 'basic', status: 'ACTIVE', expiryDate: null, daysLeft: null, isFreeForever: true },
        }),
      ),
      http.post(`${API}/api/v4/auth/logout`, () => {
        loggedOut = true;
        return HttpResponse.json({ success: true, message: 'Logged out', data: null });
      }),
    );
    renderShell('neet');
    await screen.findByText('Page');

    const rail = screen.getByRole('navigation', { name: 'Main' });
    expect(within(rail).getByRole('link', { name: 'Mock Tests' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('link', { name: 'Custom Exam' })).toHaveAttribute('href', '/neet/custom-test');
    expect(within(rail).getByRole('button', { name: 'Daily Practice' })).toBeInTheDocument();
    expect(await screen.findByText('Topper NEET 2027 + CBSE Plan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage plan' })).toHaveAttribute('href', '/neet/plans');

    await userEvent.click(screen.getByRole('button', { name: /Switch exam/ }));
    expect(screen.getByRole('button', { name: /Switch exam/ })).toHaveAccessibleName('Exam: NEET-UG. Switch exam');
    expect(await screen.findByRole('menuitem', { name: /CBSE/ })).toHaveAttribute('href', '/cbse/dashboard');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Asha Rao')).toBeInTheDocument();
    expect(await within(menu).findByText('Free forever')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /Upgrade/ })).toHaveAttribute('href', '/neet/plans');
    expect(within(menu).getByRole('menuitem', { name: /My Plans/ })).toHaveAttribute('href', '/neet/plans');
    expect(within(menu).getByRole('menuitem', { name: /My Profile/ })).toHaveAttribute('href', '/neet/profile');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Logout' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(loggedOut).toBe(true);
  });

  it('opens the navigation drawer from the header and resolves Daily Practice to the live paper', async () => {
    server.use(
      purchased(['neet-ug', 'NEET-UG']),
      account,
      neetPlan,
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/live`, () =>
        HttpResponse.json({ success: true, data: { dpp: { dpp_id: 31, dpp_name: 'DPP #3' }, question_count: 10, attempt: null } }),
      ),
    );
    const { container } = renderShell('neet');
    await screen.findByText('Page');
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(container.querySelector('aside[data-open="true"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Daily Practice' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/neet/tests/dpp/31'));
    expect(container.querySelector('aside[data-open="false"]')).not.toBeNull();
  });

  it('opens the mobile account panel with the exam list', async () => {
    server.use(purchased(['neet-ug', 'NEET-UG']), account, neetPlan);
    renderShell('neet');
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    const panel = screen.getByRole('dialog', { name: 'Account' });
    expect(await within(panel).findByText('Currently Active')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
  });
});

describe('daily practice resolution', () => {
  const neet = testExam('neet');
  const live = (dpp: unknown) => () => Promise.resolve(dpp as Awaited<ReturnType<typeof shellApi.liveDpp>>);

  it('opens the result of a submitted paper', async () => {
    const href = await resolveDailyPractice(
      neet,
      live({ dppId: '4', attempt: { status: 'submitted', attemptId: '90' } }),
    );
    expect(href).toBe('/neet/tests/dpp/result/90');
  });

  it("falls back to the latest month's first paper, then to the Daily Practice page", async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/months`, () => HttpResponse.json({ success: true, data: [{ first_dpp_id: 12 }] })),
    );
    expect(await resolveDailyPractice(neet, live(null))).toBe('/neet/tests/dpp/12');
    server.use(http.get(`${API}/api/v4/assessments/competitive/2/dpp/months`, () => HttpResponse.json({ success: true, data: [] })));
    expect(await resolveDailyPractice(neet, live(null))).toBe('/neet/daily-practice');
    expect(await resolveDailyPractice(neet, () => Promise.reject(new Error('offline')))).toBe('/neet/daily-practice');
  });

  it('computes how much of the plan is left', () => {
    const now = new Date('2026-11-01').getTime();
    expect(remainingPercent('2027-05-01', 12, now)).toBeCloseTo(49.6, 0);
    expect(remainingPercent('2020-01-01', 12, now)).toBe(0);
    expect(remainingPercent('2027-05-01', 0, now)).toBe(0);
  });
});

describe('shell API', () => {
  it('reads NEET search suggestions and live DPP details', async () => {
    server.use(
      http.get(`${API}/api/v1/student/neet-search-suggestions`, () =>
        HttpResponse.json({
          success: true,
          data: { suggestions: [{ result_name: 'Cell cycle', module_name: 'Cell Division', subject_name: 'NEET-BOTANY' }] },
        }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/live`, () =>
        HttpResponse.json({
          success: true,
          data: {
            dpp: { dpp_id: 9, dpp_name: 'Daily #21' },
            question_count: '15',
            attempted_questions: 4,
            subjects: [{ subject_name: 'NEET-ZOOLOGY' }],
            attempt: { status: 'in_progress', attempt_id: 3 },
          },
        }),
      ),
    );
    const neet = testExam('neet');
    expect(await shellApi.searchSuggestions(neet, 'cell', null)).toEqual([
      { key: '0-Cell cycle', title: 'Cell cycle', context: 'in cell division', subject: 'Botany', href: null },
    ]);
    expect(await shellApi.liveDpp(neet)).toEqual({
      dppId: '9',
      name: 'Daily #21',
      day: 21,
      questionCount: 15,
      attempted: 4,
      subjects: ['Zoology'],
      attempt: { status: 'in_progress', attemptId: '3' },
    });
    expect(subjectLabel('NEET-PHYSICS')).toBe('Physics');
  });
});

describe('reference frame and placeholders', () => {
  it('renders reference pages with the reference theme and header', async () => {
    server.use(purchased(['cbse', 'CBSE']), account);
    navigation.pathname = '/reference-books';
    const { container } = renderWithProviders(
      <ReferenceFrame>
        <p>Books</p>
      </ReferenceFrame>,
    );
    expect(container.querySelector('[data-theme="reference"]')).not.toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Header' })).getByRole('link', { name: 'Reference Books' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('button', { name: /Exam: Reference Books/ })).toBeInTheDocument();
  });

  it('explains that a section is being moved', () => {
    renderWithProviders(<SectionPlaceholder title="Notes" action={{ label: 'Open available tests', href: '/neet/tests' }} />);
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('This section is being moved to the new app.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open available tests' })).toHaveAttribute('href', '/neet/tests');
  });
});

describe('LimitDialog', () => {
  it('opens with the backend message whenever a request hits a plan limit', async () => {
    server.use(
      http.get(`${API}/api/limited`, () => HttpResponse.json({ message: 'Daily doubt limit reached.' }, { status: 429 })),
    );
    renderWithProviders(<LimitDialog />);
    await act(() => apiClient.get('/api/limited').catch(() => undefined));
    expect(await screen.findByRole('dialog', { name: 'Limit reached' })).toHaveTextContent('Daily doubt limit reached.');
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ExamFrame exam id from the backend', () => {
  function ShowExamId() {
    return <p>exam id {useExam().examId}</p>;
  }

  it('uses the exam_id from /api/v4/exams, not a hard-coded one', async () => {
    server.use(
      http.get(`${API}/api/v4/exams`, () =>
        HttpResponse.json({ success: true, data: [{ exam_id: 41, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' }] }),
      ),
      http.get(`${API}/api/v4/student/exams/purchased`, () =>
        HttpResponse.json({ success: true, data: { exams: [{ exam_id: 41, exam_slice: 'cbse', exam_name: 'CBSE' }] } }),
      ),
    );
    renderWithProviders(
      <ExamFrame examSlug="cbse">
        <ShowExamId />
      </ExamFrame>,
    );
    expect(await screen.findByText('exam id 41')).toBeInTheDocument();
  });

  it('says so when the backend has no such active exam', async () => {
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json({ success: true, data: [] })));
    renderWithProviders(
      <ExamFrame examSlug="cbse">
        <ShowExamId />
      </ExamFrame>,
    );
    expect(await screen.findByText("CBSE isn't available right now")).toBeInTheDocument();
  });
});
