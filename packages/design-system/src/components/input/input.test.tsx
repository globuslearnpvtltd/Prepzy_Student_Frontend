import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input.tsx';

describe('Input', () => {
  it('applies config defaults and accepts typing', async () => {
    render(<Input aria-label="Phone" />);
    const input = screen.getByRole('textbox', { name: 'Phone' });
    expect(input).toHaveClass('pz-input');
    expect(input).toHaveAttribute('data-size', 'md');
    await userEvent.type(input, '9876543210');
    expect(input).toHaveValue('9876543210');
  });

  it('marks invalid fields for assistive technology', () => {
    render(<Input aria-label="Email" invalid size="lg" />);
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-size', 'lg');
  });

  it('can be disabled', () => {
    render(<Input aria-label="Name" disabled />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
  });
});
