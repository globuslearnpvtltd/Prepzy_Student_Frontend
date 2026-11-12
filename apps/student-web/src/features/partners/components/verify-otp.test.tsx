import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { partnerRoutes } from '../api';
import { API, server } from '@/test/server';
import { SignupSuccess } from './signup-success';
import { RESEND_SECONDS, useCountdown } from './use-countdown';
import { VerifyOtp, type VerifyOtpProps } from './verify-otp';

const digit = (n: number) => screen.getByLabelText(`Digit ${n}`) as HTMLInputElement;
const values = () => [1, 2, 3, 4, 5, 6].map((n) => digit(n).value).join('');

function setup(props: Partial<VerifyOtpProps> = {}) {
  const handlers = { onBack: vi.fn(), onResend: vi.fn(), onVerify: vi.fn(() => Promise.resolve(true)) };
  const all = { phone: '9876543210', error: '', verifying: false, sending: false, resendTimer: 0, ...handlers, ...props };
  const view = render(<VerifyOtp {...all} />);
  return { ...view, ...all };
}

describe('VerifyOtp', () => {
  it('moves through the boxes, ignores letters and verifies on Enter', async () => {
    const user = userEvent.setup();
    const { onVerify } = setup();
    expect(digit(1)).toHaveFocus();
    const verify = screen.getByRole('button', { name: 'Verify & continue' });
    expect(verify).toBeDisabled();

    await user.keyboard('12a3');
    expect(values()).toBe('123');
    expect(digit(4)).toHaveFocus();
    await user.keyboard('456');
    expect(digit(6)).toHaveFocus(); // the last box keeps focus
    expect(verify).toBeEnabled();
    await user.keyboard('{Enter}');
    expect(onVerify).toHaveBeenCalledWith('123456');
  });

  it('backspace on an empty box goes back one; on a filled box it just clears it', async () => {
    const user = userEvent.setup();
    setup();
    await user.keyboard('12');
    expect(digit(3)).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(digit(2)).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(values()).toBe('1');
    expect(digit(2)).toHaveFocus();
    await user.click(digit(1));
    await user.keyboard('{Backspace}{Backspace}');
    expect(digit(1)).toHaveFocus(); // nothing before the first box
    // Enter with an incomplete code does nothing
    await user.keyboard('{Enter}');
  });

  it('pastes a code with separators, ignores pastes without digits, and clears the boxes when the code is wrong', async () => {
    const user = userEvent.setup();
    const { onVerify } = setup({ onVerify: vi.fn(() => Promise.resolve(false)), mode: 'login' });
    fireEvent.paste(digit(1), { clipboardData: { getData: () => 'no code here' } });
    expect(values()).toBe('');

    fireEvent.paste(digit(1), { clipboardData: { getData: () => '12-34' } });
    expect(values()).toBe('1234');
    expect(digit(5)).toHaveFocus();
    fireEvent.paste(digit(1), { clipboardData: { getData: () => '987 654 321' } });
    expect(values()).toBe('987654');
    expect(digit(6)).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(onVerify).toHaveBeenCalledWith('987654');
    await waitFor(() => expect(values()).toBe(''));
    expect(digit(1)).toHaveFocus();
  });

  it('shows the error, the verifying and sending states and the resend countdown', async () => {
    const user = userEvent.setup();
    const { rerender, onBack, onResend, onVerify, ...props } = setup({ error: 'Invalid OTP', verifying: true, resendTimer: 12 });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid OTP');
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
    expect(screen.getByText('Resend in 12s')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument();
    expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThan(0);

    // a full code can't be sent twice while one is being verified
    fireEvent.paste(digit(1), { clipboardData: { getData: () => '111111' } });
    await user.keyboard('{Enter}');
    expect(onVerify).not.toHaveBeenCalled();

    const next = { ...props, onBack, onResend, onVerify, verifying: false, error: '' };
    rerender(<VerifyOtp {...next} resendTimer={0} sending />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();

    rerender(<VerifyOtp {...next} resendTimer={0} sending={false} />);
    await user.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(values()).toBe('');
    expect(digit(1)).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('useCountdown', () => {
  it('counts down from the resend wait to zero', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCountdown());
      expect(result.current.seconds).toBe(0);
      act(() => result.current.start());
      expect(result.current.seconds).toBe(RESEND_SECONDS);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.seconds).toBe(RESEND_SECONDS - 1);
      for (let i = 0; i < RESEND_SECONDS + 2; i += 1) act(() => vi.advanceTimersByTime(1000));
      expect(result.current.seconds).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SignupSuccess', () => {
  const V4 = `${API}/api/v4/partners`;
  const summary = (shareLink: string | null) =>
    http.get(`${V4}/summary`, () => HttpResponse.json({ success: true, data: { code: 'ANITA50', shareLink, balance: 0, friendCount: 0 } }));

  it('waits for the link, then copies it and goes to the dashboard', async () => {
    const user = userEvent.setup();
    const onGoToDashboard = vi.fn();
    server.use(summary('https://prepzy.ai/r/ANITA50'));
    renderWithProviders(<SignupSuccess onGoToDashboard={onGoToDashboard} />);
    expect(screen.getAllByText('Getting your link…')).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: 'Copy link' })) expect(button).toBeDisabled();

    expect((await screen.findAllByText('prepzy.ai/r/ANITA50')).length).toBe(2);
    await user.click(screen.getAllByRole('button', { name: 'Copy link' })[0]!);
    expect(await navigator.clipboard.readText()).toBe('https://prepzy.ai/r/ANITA50');
    expect(screen.getAllByRole('button', { name: 'Copied!' })).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Copy link' })).toHaveLength(2), { timeout: 2500 });

    await user.click(screen.getAllByRole('button', { name: 'Go to my dashboard' })[1]!);
    expect(onGoToDashboard).toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: 'How payouts work' })[0]).toHaveAttribute('href', partnerRoutes.payouts);
  });

  it('does not claim it copied when the clipboard is blocked', async () => {
    const user = userEvent.setup();
    server.use(summary('https://prepzy.ai/r/ANITA50'));
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));
    renderWithProviders(<SignupSuccess onGoToDashboard={vi.fn()} />);
    await screen.findAllByText('prepzy.ai/r/ANITA50');
    await user.click(screen.getAllByRole('button', { name: 'Copy link' })[0]!);
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });
});
