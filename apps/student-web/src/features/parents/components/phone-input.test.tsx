import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { whatsappFormSchema } from '../schemas';
import { CountryPhoneInput } from './phone-input';

const registration: UseFormRegisterReturn = {
  name: 'phone',
  onChange: () => Promise.resolve(),
  onBlur: () => Promise.resolve(),
  ref: () => undefined,
};

describe('CountryPhoneInput', () => {
  it('lists countries by name with their dial code and reports a change', async () => {
    const onCountryChange = vi.fn();
    render(<CountryPhoneInput id="phone" country="IN" onCountryChange={onCountryChange} registration={registration} />);
    expect(screen.getByRole('option', { name: 'India (+91)' })).toBeInTheDocument();
    expect(screen.getByText('+91')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Country code' }), 'AE');
    expect(onCountryChange).toHaveBeenCalledWith('AE');
  });

  it('falls back to country codes without Intl.DisplayNames, and to +91 for an unknown country', () => {
    vi.stubGlobal('Intl', { ...Intl, DisplayNames: undefined });
    try {
      render(<CountryPhoneInput id="phone" country="ZZ" onCountryChange={vi.fn()} registration={registration} />);
      expect(screen.getByRole('option', { name: 'IN (+91)' })).toBeInTheDocument();
      expect(screen.getByText('+91')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('whatsappFormSchema', () => {
  it('joins the dial code and digits, defaulting to India for an unknown country', () => {
    expect(whatsappFormSchema.parse({ country: 'AE', phone: '50 123 4567' })).toBe('+971501234567');
    expect(whatsappFormSchema.parse({ country: 'ZZ', phone: '98765-43210' })).toBe('+919876543210');
    expect(whatsappFormSchema.safeParse({ country: 'IN', phone: '123' }).success).toBe(false);
  });
});
