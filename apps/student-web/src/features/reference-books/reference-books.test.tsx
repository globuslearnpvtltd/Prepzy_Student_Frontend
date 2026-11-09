import { render, screen } from '@testing-library/react';
import { ReferenceBooksComingSoon } from './ui';

describe('reference books', () => {
  it('says reference books are coming soon', () => {
    render(<ReferenceBooksComingSoon />);
    expect(screen.getByRole('heading', { name: 'Reference books are coming soon' })).toBeInTheDocument();
  });
});
