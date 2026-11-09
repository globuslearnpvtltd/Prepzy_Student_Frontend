import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { FreeCourses } from './free-courses';

const cbse = getExam('cbse')!;
const PLACEHOLDER = '/illustrations/dashboard/free-course.jpg';
const endpoint = `${API}/api/v1/student/free-courses`;

describe('FreeCourses', () => {
  it('lists free courses linking to the course, with a placeholder for missing or broken art', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: {
            free_courses: [
              { course_id: 5, title: 'Light', class_name: 'Class 10', subject_name: 'Science', image: 'https://cdn.test/light.png', unique_lecture: 6, assessment_count: 2 },
              { course_id: 6, title: 'Algebra', class_name: 'Class 10', subject_name: 'Maths', image: 'null' },
            ],
          },
        }),
      ),
    );
    const { container } = renderWithProviders(<FreeCourses />, { exam: cbse });
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    const light = await screen.findByRole('link', { name: /Light/ });
    expect(light).toHaveAttribute('href', '/cbse/learn/5');
    expect(light).toHaveTextContent('6 Lessons - 2 Tests');
    expect(screen.getByRole('link', { name: /Algebra/ })).toHaveTextContent('0 Lessons - 0 Tests');

    const [art, fallback] = [...container.querySelectorAll('img')];
    expect(fallback!.getAttribute('src')).toBe(PLACEHOLDER);
    fireEvent.error(art!);
    expect(art!.getAttribute('src')).toBe(PLACEHOLDER);
    // a broken placeholder is not retried
    fireEvent.error(fallback!);
    expect(fallback!.getAttribute('src')).toBe(PLACEHOLDER);
  });

  it('says when there are no free courses', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ success: true, data: {} })));
    renderWithProviders(<FreeCourses />, { exam: cbse });
    expect(await screen.findByText('No Free Courses Available')).toBeInTheDocument();
  });

  it('shows the error for an HTTP-200 failure body', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ success: false, message: 'Not allowed' })));
    renderWithProviders(<FreeCourses />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch Subject Data')).toBeInTheDocument();
  });
});
