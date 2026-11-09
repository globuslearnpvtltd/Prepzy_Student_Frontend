import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import type { EarnRate, FeaturedPurchase, Friend, PlanOption } from './api';
import { ClosingCta, HeroBanner } from './components/hero';
import { MoneyFlowExample, MoneyFlowFriend } from './components/money-flow';
import { SendCreditsDialog } from './components/send-credits-dialog';

const percentRate: EarnRate = {
  examId: null,
  flat: false,
  signupFree: 25,
  signupPaid: 50,
  rateFree: 10,
  ratePaid: 20,
  floor: 50,
  cap: 500,
  flatAmount: null,
};
const flatRate: EarnRate = { ...percentRate, examId: 2, flat: true, signupFree: 30, signupPaid: 60, rateFree: null, ratePaid: null, flatAmount: 300 };

const plan: PlanOption = {
  priceId: 11,
  examId: 1,
  classId: 12,
  group: 'CBSE Class 12',
  label: 'CBSE 12 · Topper academic year',
  phrase: 'the CBSE Class 12 Topper plan',
  price: 4000,
  durationMonths: 12,
  isCombo: false,
};

const friend: Friend = {
  id: 1,
  status: 'paid',
  paidAt: '2025-03-02',
  name: 'Riya',
  phone: '+919876543210',
  examName: 'CBSE',
  signupCredit: 25,
  conversionCredit: 400,
};

describe('HeroBanner', () => {
  const reward = { join: 25, percent: 10, floor: null, cap: null, flat: null };

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the share link and resets the label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onShare = vi.fn();
    render(<HeroBanner shareLink="https://prepzy.ai/join?ref=AB" reward={reward} onShare={onShare} />);
    expect(screen.getByText(/You get ₹25 when they join and 10% of their plan/)).toBeInTheDocument();
    expect(screen.getByTitle('https://prepzy.ai/join?ref=AB')).toHaveTextContent('prepzy.ai/…?ref=AB');
    fireEvent.click(screen.getByRole('button', { name: 'Share on WhatsApp' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Link copied' })).toHaveTextContent('Copied');
    expect(writeText).toHaveBeenCalledWith('https://prepzy.ai/join?ref=AB');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument(), { timeout: 2500 });
  });

  it('keeps the copy button when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<HeroBanner shareLink="https://prepzy.ai/x" reward={reward} onShare={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
  });
});

describe('ClosingCta', () => {
  it('invites a first friend when there are none', () => {
    const onShare = vi.fn();
    render(<ClosingCta hasFriends={false} joinCredit={100} onShare={onShare} />);
    expect(screen.getByText('Who will be your first friend on Prepzy?')).toBeInTheDocument();
    expect(screen.getByText(/you get ₹100 the moment they join/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share Your Referral Link With Other Students' }));
    expect(onShare).toHaveBeenCalled();
  });

  it('asks for another friend once someone joined', () => {
    render(<ClosingCta hasFriends joinCredit={50} onShare={vi.fn()} />);
    expect(screen.getByText('Know someone else preparing for boards or NEET?')).toBeInTheDocument();
    expect(screen.getByText(/adds ₹50 to your credits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share Your Referral Link' })).toBeInTheDocument();
  });
});

describe('MoneyFlowExample', () => {
  it('renders nothing without an example plan', () => {
    const { container } = render(<MoneyFlowExample ownTier="free" rates={[percentRate]} plan={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the percentage share and switches to the Topper view', async () => {
    render(<MoneyFlowExample ownTier="free" rates={[percentRate]} plan={plan} />);
    expect(screen.getByText('You are on Basic')).toBeInTheDocument();
    // 10% of ₹4,000 = ₹400, within the floor and cap: the plain sentence.
    expect(screen.getByText('10% of it, ₹400, comes to you')).toBeInTheDocument();
    expect(screen.getByText('₹25 when they join + ₹400 when they buy')).toBeInTheDocument();
    expect(screen.getAllByText('₹425').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: 'Topper' }));
    expect(screen.getByText('Earns twice as much')).toBeInTheDocument();
    // 20% = ₹800, capped at ₹500: no longer the plain percentage of the price.
    expect(screen.getByText('Your share, ₹500, comes to you')).toBeInTheDocument();
    expect(screen.getByText('₹50 when they join + ₹500 when they buy')).toBeInTheDocument();
  });

  it('uses the flat amount for exams paid out per purchase', () => {
    render(<MoneyFlowExample ownTier="paid" rates={[percentRate, flatRate]} plan={{ ...plan, examId: 2 }} />);
    expect(screen.getByText('You are on Topper')).toBeInTheDocument();
    expect(screen.getByText('Your share, ₹300, comes to you')).toBeInTheDocument();
  });
});

describe('MoneyFlowFriend', () => {
  const purchase: FeaturedPurchase = { friend, paid: 4000, tier: 'free', examId: 1, join: 25, share: 400 };

  it('explains a named friend’s purchase and nudges a Basic student to Topper', () => {
    render(<MoneyFlowFriend purchase={purchase} ownTier="free" rates={[percentRate]} balance={425} plansHref="/cbse/plans" />);
    expect(screen.getByText('How Riya’s plan turned into your credits')).toBeInTheDocument();
    expect(
      screen.getByText('Riya joined with your link and bought a CBSE plan. You were on Basic plan when they bought, so your share was 10%.'),
    ).toBeInTheDocument();
    expect(screen.getByText('10% of it, ₹400, came to you')).toBeInTheDocument();
    expect(screen.getByText('₹25 when Riya joined + ₹400 when they bought')).toBeInTheDocument();
    expect(screen.getByText(/On Topper, Riya would have brought you ₹550/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Topper plans →' })).toHaveAttribute('href', '/cbse/plans');
    expect(screen.getByText('What you can do with your ₹425')).toBeInTheDocument();
  });

  it('shows only the real amount when rates changed since an unnamed friend bought', () => {
    const changed: FeaturedPurchase = { ...purchase, friend: { ...friend, name: null, examName: null }, share: 123, tier: 'paid' };
    render(<MoneyFlowFriend purchase={changed} ownTier="paid" rates={[percentRate]} balance={0} plansHref="/x" />);
    expect(screen.getByText('How your friend’s plan turned into your credits')).toBeInTheDocument();
    expect(screen.getAllByText('Your friend joined with your link and bought a plan. Your share was ₹123.')).toHaveLength(2);
    expect(screen.getByText('Your share, ₹123, came to you')).toBeInTheDocument();
    expect(screen.getByText('₹25 when your friend joined + ₹123 when they bought')).toBeInTheDocument();
    expect(screen.queryByText('See Topper plans →')).toBeNull();
  });

  it('describes a flat share without the percentage sentence', () => {
    const flat: FeaturedPurchase = { ...purchase, examId: 2, share: 300, tier: 'paid' };
    render(<MoneyFlowFriend purchase={flat} ownTier="free" rates={[percentRate, flatRate]} balance={0} plansHref="/x" />);
    expect(screen.getByText(/You were on Topper plan when they bought, so your share was ₹300\./)).toBeInTheDocument();
    expect(screen.getByText('Your share, ₹300, came to you')).toBeInTheDocument();
  });
});

describe('SendCreditsDialog', () => {
  const lookup = (respond: () => Response) => http.get(`${API}/api/referral/transfer/lookup`, respond);

  it('shows a 200 "not found" body, lets the student change a found number and closes', async () => {
    let calls = 0;
    server.use(
      lookup(() => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'Student not found' })
          : HttpResponse.json({ success: true, data: { accountId: 5, name: 'Kabir' } });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<SendCreditsDialog open balance={200} onClose={onClose} onSent={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('You have ₹200 to send to another Prepzy student.')).toBeInTheDocument();
    const phone = within(dialog).getByLabelText('Their mobile number');
    await userEvent.type(phone, '9876543210');
    expect(within(dialog).getByText('Looking them up…')).toBeInTheDocument();
    expect(await within(dialog).findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent('Student not found');
    await userEvent.type(phone, '1');
    expect(await within(dialog).findByText(/Kabir · 98765432101/, {}, { timeout: 2000 })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(within(dialog).getByLabelText('Their mobile number')).toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('treats an empty lookup as not found', async () => {
    server.use(lookup(() => HttpResponse.json({ success: true, data: null })));
    renderWithProviders(<SendCreditsDialog open balance={200} onClose={vi.fn()} onSent={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText('Their mobile number'), '9876543210');
    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent("Couldn't find a student with that number");
  });

  it('shows a failed transfer, then sends and finishes with Done', async () => {
    let attempts = 0;
    server.use(
      lookup(() => HttpResponse.json({ success: true, data: { accountId: 5, name: 'Kabir' } })),
      http.post(`${API}/api/referral/transfer`, async ({ request }) => {
        attempts += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ recipientAccountId: 5, amount: 50 });
        return attempts === 1
          ? HttpResponse.json({ success: false, message: 'Transfers are paused' })
          : HttpResponse.json({ success: true, data: { newBalance: 150 } });
      }),
    );
    const onSent = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<SendCreditsDialog open balance={200} onClose={onClose} onSent={onSent} />);
    await userEvent.type(await screen.findByLabelText('Their mobile number'), '9876543210');
    await screen.findByText(/Kabir ·/, {}, { timeout: 2000 });
    await userEvent.type(screen.getByLabelText('Amount'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Send credits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Transfers are paused');
    expect(onSent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Send credits' }));
    expect(await screen.findByText('Credits sent')).toBeInTheDocument();
    expect(screen.getByText('₹50 is on its way to Kabir.')).toBeInTheDocument();
    expect(onSent).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps sending disabled for a zero amount', async () => {
    server.use(lookup(() => HttpResponse.json({ success: true, data: { accountId: 5, name: 'Kabir' } })));
    renderWithProviders(<SendCreditsDialog open balance={200} onClose={vi.fn()} onSent={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText('Their mobile number'), '9876543210');
    await screen.findByText(/Kabir ·/, {}, { timeout: 2000 });
    await userEvent.type(screen.getByLabelText('Amount'), '0');
    expect(screen.getByRole('button', { name: 'Send credits' })).toBeDisabled();
    expect(screen.queryByText(/left$/)).toBeNull();
  });
});
