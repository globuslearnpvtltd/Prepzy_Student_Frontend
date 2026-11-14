import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { testExam } from '@/test/exams';
import { AppHeader } from './app-header';

const marketing = vi.hoisted(() => ({ url: undefined as string | undefined }));
vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return {
    env: new Proxy(actual.env, { get: (target, key) => (key === 'marketingUrl' ? marketing.url : target[key as string]) }),
  };
});

const cbse = testExam('cbse');

describe('navbar logo', () => {
  afterEach(() => {
    marketing.url = undefined;
  });

  it('opens the marketing website when one is configured', () => {
    marketing.url = 'http://localhost:3001';
    renderWithProviders(<AppHeader exam={cbse} category="board" navigation={false} />, { exam: cbse });
    const links = screen.getAllByRole('link', { name: 'Prepzy website' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', 'http://localhost:3001');
    expect(screen.queryByRole('link', { name: 'Prepzy home' })).not.toBeInTheDocument();
  });

  it('stays on the dashboard without one', () => {
    renderWithProviders(<AppHeader exam={cbse} category="board" navigation={false} />, { exam: cbse });
    for (const link of screen.getAllByRole('link', { name: 'Prepzy home' })) expect(link).toHaveAttribute('href', '/cbse/dashboard');
  });
});
