import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { schoolsApi, toSchool, toTeacher } from './api';
import { SchoolsDashboard } from './components/schools-dashboard';
import { SchoolsHeader } from './components/schools-header';
import { SchoolsLogin } from './components/schools-login';
import { SchoolsStudentDetail } from './components/student-detail';
import { schoolsKeys } from './hooks';
import { axisTicks, buildWeek, formatJoined, initials, schoolsRoutes, share } from './model';

const AUTH = `${API}/api/mentor/v1/auth`;
const SCHOOLS = `${API}/api/mentor/v1/schools`;

const school = {
  institute_id: 3,
  institute_name: 'Greenfield Public School',
  address: 'Bengaluru',
  student_count: 42,
  class_count: 2,
  class_list: [
    { class_id: 10, class_name: 'Class 10', stream_name: 'CBSE' },
    { class_id: 9, class_name: 'Class 9', stream_name: 'CBSE' },
  ],
};

function dashboardHandlers(
  students: Record<string, unknown>[] = [{ account_id: 7, first_name: 'Aarav', last_name: 'Sharma' }],
) {
  const seen: string[] = [];
  server.use(
    http.get(`${SCHOOLS}/get-school-info`, () =>
      HttpResponse.json({ success: true, data: { institution_data: school } }),
    ),
    http.get(`${SCHOOLS}/get-hours-data`, ({ request }) => {
      seen.push(new URL(request.url).search);
      const tenth = new URL(request.url).searchParams.get('class_id') === '10';
      return HttpResponse.json({
        success: true,
        data: { student_count: tenth ? 18 : 25, unique_students: 12, total_hours: 36.5 },
      });
    }),
    http.get(`${SCHOOLS}/get-feature-usage`, () =>
      HttpResponse.json({
        success: true,
        data: {
          avg_exam_attempts: 4,
          chat_doubts: 23,
          total_lectures: 15,
          total_doubt_solver_chats: 9,
          custom_exam_count: 3,
          post_assessment_chat: 6,
        },
      }),
    ),
    http.get(`${SCHOOLS}/get-student-list`, () =>
      HttpResponse.json({ success: true, data: { student_list: students } }),
    ),
  );
  return seen;
}

describe('schools model', () => {
  it('builds the last seven days ending with Today, in minutes', () => {
    const sunday = new Date('2026-11-08T10:00:00');
    const week = buildWeek({ Mon: 1.5, Sat: 0.25, Today: 1 }, sunday);
    expect(week.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']);
    expect(week[0]).toEqual({ label: 'Mon', minutes: 90 });
    expect(week[5]!.minutes).toBe(15);
    expect(week[6]!.minutes).toBe(60);
  });

  it('computes round axis ticks', () => {
    expect(axisTicks(120)).toEqual([0, 30, 60, 90, 120]);
    expect(axisTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(axisTicks(7).at(-1)).toBeGreaterThanOrEqual(7);
  });

  it('formats names, dates, shares and links', () => {
    expect(initials('aarav', 'sharma')).toBe('AS');
    expect(initials('', '')).toBe('?');
    expect(formatJoined(null)).toBe('—');
    expect(formatJoined('not a date')).toBe('—');
    expect(formatJoined('2025-06-12T10:00:00Z')).toMatch(/2025/);
    expect(share(1, 4)).toBe('25%');
    expect(share(1, 0)).toBe('0%');
    expect(schoolsRoutes.student(7, 10)).toBe('/schools/students/7?class_id=10');
    expect(schoolsRoutes.student(7)).toBe('/schools/students/7');
    expect(schoolsRoutes.dashboard()).toBe('/schools/dashboard');
  });

  it('normalises backend payloads', () => {
    expect(toTeacher(null)).toBeNull();
    expect(toTeacher({ account_id: 5, first_name: 'Anita', email: 'a@b.c' })).toEqual({
      id: '5',
      firstName: 'Anita',
      lastName: '',
      email: 'a@b.c',
    });
    expect(toSchool(undefined)).toBeNull();
    expect(toSchool({ institute_id: 1, class_list: [{ class_id: 2, class_name: 'X' }] })).toMatchObject({
      classCount: 1,
      classes: [{ id: 2, name: 'X', stream: '' }],
    });
  });

  it('reads student detail endpoints with missing fields', async () => {
    server.use(
      http.get(`${SCHOOLS}/get-student-info`, () => HttpResponse.json({ success: true, data: { student_data: null } })),
      http.get(`${SCHOOLS}/get-student-learning-hours-info`, () => HttpResponse.json({ success: true, data: {} })),
      http.get(`${SCHOOLS}/get-student-video-completion-info`, () =>
        HttpResponse.json({ success: true, data: { video_completion: { total: 0, subjects: [], chapters: [] } } }),
      ),
    );
    await expect(schoolsApi.student('7')).resolves.toBeNull();
    await expect(schoolsApi.learningHours({ studentId: '7' })).resolves.toEqual({
      graph: {},
      thisWeek: 0,
      totalSinceJoining: 0,
      avgMinutesPerActiveDay: 0,
    });
    await expect(schoolsApi.lectures({ studentId: '7' })).resolves.toEqual({ total: 0, subjects: [], chapters: [] });
  });
});

describe('SchoolsLogin', () => {
  async function sendCode(user: ReturnType<typeof userEvent.setup>, email = 'anita@school.edu') {
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
  }

  it('validates the email before calling the backend', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SchoolsLogin />);
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address.');
  });

  it('requests a code, verifies it and opens the dashboard', async () => {
    let requested: unknown;
    let verified: unknown;
    server.use(
      http.post(`${AUTH}/generate-teacher-login-otp`, async ({ request }) => {
        requested = await request.json();
        return HttpResponse.json({ success: true });
      }),
      http.post(`${AUTH}/verify-teacher-login-otp`, async ({ request }) => {
        verified = await request.json();
        return HttpResponse.json({ success: true, account_id: 11, first_name: 'Anita', email: 'anita@school.edu' });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<SchoolsLogin />);
    await sendCode(user);

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(requested).toEqual({ email: 'anita@school.edu' });
    expect(screen.getByText('anita@school.edu')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Digit 1'), '123456');
    expect(screen.getByLabelText('Digit 6')).toHaveValue('6');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/schools/dashboard'));
    expect(verified).toEqual({ email: 'anita@school.edu', otp: '123456' });
    expect(queryClient.getQueryData(schoolsKeys.me)).toMatchObject({ firstName: 'Anita' });
  });

  it('shows the backend message for unknown emails (HTTP 400)', async () => {
    server.use(
      http.post(`${AUTH}/generate-teacher-login-otp`, () =>
        HttpResponse.json({ message: 'This phone number or email is not registered.' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SchoolsLogin />);
    await sendCode(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('This phone number or email is not registered.');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('treats an HTTP-200 { success: false } as a failure', async () => {
    server.use(
      http.post(`${AUTH}/generate-teacher-login-otp`, () =>
        HttpResponse.json({ success: false, message: 'Mail is down' }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SchoolsLogin />);
    await sendCode(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mail is down');
  });

  it('shows invalid codes returned as HTTP 200 { error }, clears the boxes and can go back', async () => {
    let resent = 0;
    server.use(
      http.post(`${AUTH}/generate-teacher-login-otp`, () => {
        resent += 1;
        return HttpResponse.json({ success: true });
      }),
      http.post(`${AUTH}/verify-teacher-login-otp`, () => HttpResponse.json({ error: 'Invalid Otp' })),
    );
    const user = userEvent.setup();
    renderWithProviders(<SchoolsLogin />);
    await sendCode(user);
    await screen.findByRole('heading', { name: 'Check your email' });

    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code.');

    await user.type(screen.getByLabelText('Digit 1'), '999999');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByText('Invalid Otp')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Digit 1')).toHaveValue(''));
    expect(navigation.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(resent).toBe(2));

    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByLabelText('Email')).toHaveValue('anita@school.edu');
  });

  it('ignores letters and moves back on Backspace', async () => {
    server.use(http.post(`${AUTH}/generate-teacher-login-otp`, () => HttpResponse.json({ success: true })));
    const user = userEvent.setup();
    renderWithProviders(<SchoolsLogin />);
    await sendCode(user);
    await screen.findByRole('heading', { name: 'Check your email' });
    await user.type(screen.getByLabelText('Digit 1'), 'a');
    expect(screen.getByLabelText('Digit 1')).toHaveValue('');
    await user.type(screen.getByLabelText('Digit 1'), '1');
    expect(screen.getByLabelText('Digit 2')).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(screen.getByLabelText('Digit 1')).toHaveFocus();
  });
});

describe('SchoolsDashboard', () => {
  it('shows the school, class stats, feature usage and students', async () => {
    const seen = dashboardHandlers();
    const user = userEvent.setup();
    renderWithProviders(<SchoolsDashboard />);

    expect(await screen.findByRole('heading', { name: 'Greenfield Public School, Bengaluru' })).toBeInTheDocument();
    expect(screen.getByText('42 Students')).toBeInTheDocument();
    expect(screen.getByText('2 Classes')).toBeInTheDocument();
    expect(await screen.findByText('students joined in Class 10 CBSE')).toBeInTheDocument();
    expect(await screen.findByText('18')).toBeInTheDocument();
    expect(screen.getByText('36.5 Hours')).toBeInTheDocument();
    expect(await screen.findByText('Post Assessments Interaction')).toBeInTheDocument();
    expect(await screen.findByText('23')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Aarav Sharma' });
    expect(link).toHaveAttribute('href', '/schools/students/7?class_id=10');
    expect(seen[0]).toContain('class_id=10');
    expect(seen[0]).toContain('institution_id=3');

    await user.click(screen.getByRole('button', { name: 'Class 9 CBSE' }));
    expect(screen.getByRole('button', { name: 'Class 9 CBSE' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('25')).toBeInTheDocument();
  });

  it('shows an empty class', async () => {
    dashboardHandlers([]);
    renderWithProviders(<SchoolsDashboard />);
    expect(await screen.findByText('No students in this class yet.')).toBeInTheDocument();
  });

  it('shows errors from the school and student list', async () => {
    dashboardHandlers();
    server.use(
      http.get(`${SCHOOLS}/get-student-list`, () => HttpResponse.json({ success: false, message: 'Class not found' })),
    );
    renderWithProviders(<SchoolsDashboard />);
    expect(await screen.findByText(/Couldn.t load students\. Class not found/)).toBeInTheDocument();
  });

  it('reports a failed school request', async () => {
    server.use(http.get(`${SCHOOLS}/get-school-info`, () => HttpResponse.json({ message: 'Nope' }, { status: 403 })));
    renderWithProviders(<SchoolsDashboard />);
    expect(await screen.findByText(/Couldn.t load your school/)).toBeInTheDocument();
  });

  it('says when the school has no classes', async () => {
    server.use(
      http.get(`${SCHOOLS}/get-school-info`, () =>
        HttpResponse.json({ success: true, data: { institution_data: { ...school, class_list: [], class_count: 0 } } }),
      ),
    );
    renderWithProviders(<SchoolsDashboard />);
    expect(await screen.findByText('No classes are linked to your school yet.')).toBeInTheDocument();
  });
});

describe('SchoolsStudentDetail', () => {
  function studentHandlers() {
    const queries: string[] = [];
    const track = (request: Request) => queries.push(new URL(request.url).search);
    server.use(
      http.get(`${SCHOOLS}/get-student-info`, ({ request }) => {
        track(request);
        return HttpResponse.json({
          success: true,
          data: {
            student_data: {
              account_id: 7,
              first_name: 'Aarav',
              last_name: 'Sharma',
              school: 'Greenfield Public School',
              class_title: 'Class 10',
              created_at: '2025-06-12T10:00:00.000Z',
            },
          },
        });
      }),
      http.get(`${SCHOOLS}/get-student-learning-hours-info`, ({ request }) => {
        track(request);
        return HttpResponse.json({
          success: true,
          data: {
            graph_data: { Mon: 1, Today: 0.5 },
            study_engagement: {
              this_week: { hours: 6 },
              total_since_joining_hours: 48,
              avg_minutes_per_active_day: 55,
            },
          },
        });
      }),
      http.get(`${SCHOOLS}/get-student-video-completion-info`, () =>
        HttpResponse.json({
          success: true,
          data: {
            video_completion: {
              total: 14,
              subjects: [
                { subject_id: 1, subject_name: 'Science', count: 6 },
                { subject_id: 2, subject_name: 'Mathematics', count: 8 },
              ],
              chapters: ['Light', 'Polynomials'],
            },
          },
        }),
      ),
      http.get(`${SCHOOLS}/get-student-doubts-section-info`, () =>
        HttpResponse.json({
          success: true,
          data: {
            doubts: {
              total: 31,
              subjects: [{ name: 'Chemistry', count: 8 }],
              categories: [
                { label: 'ATLAS', count: 15 },
                { label: 'Lecture Chat', count: 9 },
              ],
            },
          },
        }),
      ),
      http.get(`${SCHOOLS}/get-student-assessment-section-info`, () =>
        HttpResponse.json({
          success: true,
          data: { assessments: { total: 12, categories: [{ label: 'Quiz', count: 4, percentage: 78 }] } },
        }),
      ),
    );
    return queries;
  }

  it('shows the student profile and their weekly activity', async () => {
    const queries = studentHandlers();
    renderWithProviders(<SchoolsStudentDetail studentId="7" classId="10" />);

    expect(await screen.findByRole('heading', { name: 'Aarav Sharma' })).toBeInTheDocument();
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('Class 10 · Greenfield Public School')).toBeInTheDocument();
    expect(screen.getByText(/Since .*2025/)).toBeInTheDocument();

    expect(await screen.findByText('48 Min')).toBeInTheDocument();
    expect(screen.getByText('55 Min')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Today')).toBeInTheDocument();
    expect(within(table).getByText('30 minutes')).toBeInTheDocument();

    expect(await screen.findByText('Polynomials')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(await screen.findByText('31')).toBeInTheDocument();
    expect(screen.getByText('Lecture Chat')).toBeInTheDocument();
    expect(await screen.findByText('Quiz (4)')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(queries.every((q) => q.includes('student_id=7'))).toBe(true);
    expect(queries.some((q) => q.includes('class_id=10'))).toBe(true);
  });

  it('shows errors per section', async () => {
    studentHandlers();
    server.use(
      http.get(`${SCHOOLS}/get-student-info`, () => HttpResponse.json({ message: 'Missing' }, { status: 404 })),
      http.get(`${SCHOOLS}/get-student-doubts-section-info`, () =>
        HttpResponse.json({ success: false, message: 'No doubts' }),
      ),
      http.get(`${SCHOOLS}/get-student-assessment-section-info`, () => HttpResponse.json({ error: 'Broken' })),
      http.get(`${SCHOOLS}/get-student-video-completion-info`, () => HttpResponse.json({ error: 'Gone' })),
      http.get(`${SCHOOLS}/get-student-learning-hours-info`, () => HttpResponse.json({ error: 'Later' })),
    );
    renderWithProviders(<SchoolsStudentDetail studentId="7" />);
    expect(await screen.findByText(/Couldn.t load this student\. Missing/)).toBeInTheDocument();
    expect(await screen.findByText(/Couldn.t load doubts\. No doubts/)).toBeInTheDocument();
    expect(await screen.findByText(/Couldn.t load assessments\. Broken/)).toBeInTheDocument();
    expect(await screen.findByText(/Couldn.t load video lectures\. Gone/)).toBeInTheDocument();
    expect(await screen.findByText(/Couldn.t load learning hours\. Later/)).toBeInTheDocument();
  });
});

describe('SchoolsHeader', () => {
  const teacher = () =>
    http.get(`${AUTH}/get-teacher-info`, () =>
      HttpResponse.json({
        success: true,
        data: { teacher_data: { account_id: 11, first_name: 'Anita', email: 'anita@school.edu' } },
      }),
    );

  it('shows the teacher and logs out: clears the cache and returns to the portal login', async () => {
    let loggedOut = false;
    server.use(
      teacher(),
      http.post(`${AUTH}/teacher-logout`, () => {
        loggedOut = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<SchoolsHeader />);
    queryClient.setQueryData(['schools', 'school'], { id: 3 });

    const avatar = await screen.findByRole('button', { name: 'Account menu' });
    await waitFor(() => expect(avatar).toHaveTextContent('A'));
    await user.click(avatar);
    expect(screen.getAllByText('anita@school.edu').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
    await user.click(avatar);
    await user.click(screen.getAllByRole('button', { name: 'Logout' })[0]!);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/schools/login'));
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(['schools', 'school'])).toBeUndefined();
  });

  it('still signs out when the logout request fails, from the mobile drawer', async () => {
    server.use(
      teacher(),
      http.post(`${AUTH}/teacher-logout`, () => HttpResponse.json({ message: 'down' }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderWithProviders(<SchoolsHeader />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(drawer).getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/schools/dashboard');
    await user.click(within(drawer).getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/schools/login'));
  });
});
