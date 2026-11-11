import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { ReportProblem } from './report-problem';
import { testExam } from '@/test/exams';

describe('report a problem', () => {
  it('sends the section and description as multipart form data', async () => {
    let sent: string | null = null;
    server.use(
      http.post(`${API}/api/v4/assessments/reports`, async ({ request }) => {
        sent = await request.text();
        return HttpResponse.json({ success: true, message: 'Problem Reported Successfully' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReportProblem questionId="12" questionHtml="<p>State Gauss law.</p>" />, { exam: testExam('cbse') });
    await user.click(screen.getByRole('button', { name: 'Report a problem' }));
    expect(await screen.findByRole('dialog', { name: 'Report a Problem !' })).toHaveTextContent('State Gauss law.');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mark' }));
    await user.type(screen.getByLabelText('Describe the issue'), 'Marks look wrong');
    // A screenshot shows a preview and can be removed (jsdom can't stream File bodies to MSW, so the
    // multipart body is checked without it).
    await user.upload(screen.getByLabelText('Upload Screenshot (optional)'), new File(['x'], 'shot.png', { type: 'image/png' }));
    expect(screen.getByAltText('Screenshot preview')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Remove screenshot/ }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(sent).not.toBeNull());
    const field = (name: string, value: string) => new RegExp(`name="${name}"\\r\\n\\r\\n${value}\\r\\n`);
    expect(sent).toMatch(field('category', 'pyq'));
    expect(sent).toMatch(field('section', 'Mark'));
    expect(sent).toMatch(field('question_id', '12'));
    expect(sent).toMatch(field('description', 'Marks look wrong'));
    expect(sent).not.toMatch(/name="image"/);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
