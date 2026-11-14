import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubjectCardGrid } from './subject-card';

const items = ['Maths', 'Science', 'Hindi', 'English'].map((title, i) => ({ key: String(i), title, meta: `${i} Books` }));

describe('SubjectCardGrid', () => {
  it('renders links or buttons with the same card (and hover) classes', async () => {
    const onClick = vi.fn();
    render(<SubjectCardGrid items={[{ key: 'a', title: 'Maths', meta: '4 Exams', href: '/cbse/mock-sets/1' }, { key: 'b', title: 'Science', onClick }]} />);
    const link = screen.getByRole('link', { name: /Maths/ });
    const button = screen.getByRole('button', { name: 'Science' });
    expect(link).toHaveAttribute('href', '/cbse/mock-sets/1');
    expect(link).toHaveTextContent('4 Exams');
    expect(link.className).toBe(button.className);
    expect(link).toHaveClass('hover:bg-brand', 'hover:scale-105', 'group');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole('list')).toHaveClass('md:grid-cols-3');
  });

  it('collapses to three cards on phones with a View All Subjects toggle', async () => {
    render(<SubjectCardGrid items={items} collapse columns={2} />);
    expect(screen.getByRole('list')).toHaveClass('md:grid-cols-2');
    const rows = screen.getAllByRole('listitem');
    expect(rows[3]).toHaveClass('max-md:hidden');
    await userEvent.click(screen.getByRole('button', { name: 'View All Subjects' }));
    expect(screen.getAllByRole('listitem')[3]).not.toHaveClass('max-md:hidden');
    expect(screen.getByRole('button', { name: 'Show Less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no toggle without collapse or with three cards or fewer', () => {
    const { unmount } = render(<SubjectCardGrid items={items} />);
    expect(screen.queryByRole('button', { name: 'View All Subjects' })).not.toBeInTheDocument();
    unmount();
    render(<SubjectCardGrid items={items.slice(0, 3)} collapse />);
    expect(screen.queryByRole('button', { name: 'View All Subjects' })).not.toBeInTheDocument();
  });
});
