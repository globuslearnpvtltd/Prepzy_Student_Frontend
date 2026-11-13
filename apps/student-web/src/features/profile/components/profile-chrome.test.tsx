import { screen } from '@testing-library/react';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { ProfileChrome } from './profile-chrome';

// The shell pieces have their own tests (src/shared/layout); this checks only what the account frame puts together.
vi.mock('@/shared/layout/app-header', () => ({
  AppHeader: ({ category }: { category: string }) => <header>header:{category}</header>,
}));
vi.mock('@/shared/layout/competitive-navigation', () => ({
  CompetitiveSidebar: ({ rail }: { rail: boolean }) => <nav aria-label="menu">{rail ? 'rail' : 'drawer only'}</nav>,
}));

describe('ProfileChrome', () => {
  it('board exams get the header and the page, no sidebar', () => {
    renderWithProviders(<ProfileChrome>page</ProfileChrome>, { exam: testExam('cbse') });
    expect(screen.getByRole('banner')).toHaveTextContent('header:board');
    expect(screen.getByRole('main')).toHaveTextContent('page');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('competitive exams keep the menu drawer without the desktop rail', () => {
    renderWithProviders(<ProfileChrome>page</ProfileChrome>, { exam: testExam('neet') });
    expect(screen.getByRole('banner')).toHaveTextContent('header:competitive');
    expect(screen.getByRole('navigation', { name: 'menu' })).toHaveTextContent('drawer only');
  });
});
