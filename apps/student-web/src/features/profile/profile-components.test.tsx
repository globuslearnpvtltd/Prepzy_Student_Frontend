import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { profileApi } from './api';
import { AvatarProgress } from './components/avatar-progress';
import { ParentLink } from './components/parent-link';
import { RequestDeleteScreen } from './components/request-delete-screen';
import { UploadPhoto } from './components/upload-photo';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// next/script only loads in the framework; run its onLoad straight away so the Tally hook-up is exercised.
vi.mock('next/script', () => ({
  default: ({ id, onLoad }: { id: string; onLoad?: () => void; children?: ReactNode }) => {
    onLoad?.();
    return <span data-testid={id} />;
  },
}));

const png = () => new File(['png'], 'me.png', { type: 'image/png' });

describe('UploadPhoto', () => {
  it('uploads a PNG as multipart form data and confirms it', async () => {
    let contentType: string | null = null;
    server.use(
      http.put(`${API}/api/accounts/profile_image`, async ({ request }) => {
        contentType = request.headers.get('content-type');
        return HttpResponse.json({ success: true, data: { profile_picture: 'https://x.test/me.png' } });
      }),
    );
    renderWithProviders(<UploadPhoto />);
    const input = screen.getByLabelText<HTMLInputElement>('Upload New Photo');
    await userEvent.upload(input, png());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Image uploaded successfully'));
    expect(contentType).toContain('multipart/form-data');
    // The input is cleared so the same file can be picked again.
    expect(input.value).toBe('');
  });

  it('shows the busy label while the upload is in flight', async () => {
    // jsdom drops a multipart body if the mock server holds the response, so hold the API call instead.
    let finish: () => void = () => undefined;
    const upload = vi.spyOn(profileApi, 'uploadPhoto').mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderWithProviders(<UploadPhoto />);
    await userEvent.upload(screen.getByLabelText('Upload New Photo'), png());
    expect(await screen.findByText('Uploading…')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'me.png' }));
    finish();
    expect(await screen.findByText('Upload New Photo')).toBeInTheDocument();
    upload.mockRestore();
  });

  it('rejects other file types without calling the backend', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<UploadPhoto />);
    await user.upload(screen.getByLabelText('Upload New Photo'), new File(['gif'], 'a.gif', { type: 'image/gif' }));
    expect(toast.error).toHaveBeenCalledWith('Only JPG or PNG is allowed');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', () => {
    renderWithProviders(<UploadPhoto />);
    fireEvent.change(screen.getByLabelText('Upload New Photo'), { target: { files: [] } });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the backend message when the upload fails (HTTP 200 with success:false)', async () => {
    server.use(http.put(`${API}/api/accounts/profile_image`, () => HttpResponse.json({ success: false, message: 'Image too large' })));
    renderWithProviders(<UploadPhoto />);
    await userEvent.upload(screen.getByLabelText('Upload New Photo'), png());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Image too large'));
  });

  it('falls back to a generic message on a server error', async () => {
    server.use(http.put(`${API}/api/accounts/profile_image`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<UploadPhoto />);
    await userEvent.upload(screen.getByLabelText('Upload New Photo'), png());
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('RequestDeleteScreen', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'Tally');
  });

  it('embeds the Tally deletion form and loads it once the script is ready', () => {
    const loadEmbeds = vi.fn();
    window.Tally = { loadEmbeds };
    render(<RequestDeleteScreen />);
    expect(screen.getByRole('heading', { name: 'Delete Your Account' })).toBeInTheDocument();
    expect(screen.getByTitle('Prepzy - Account Deletion Request')).toHaveAttribute('data-tally-src', expect.stringContaining('tally.so/embed/'));
    expect(screen.getByTestId('tally-js')).toBeInTheDocument();
    expect(loadEmbeds).toHaveBeenCalled();
  });

  it('tolerates the Tally global being missing', () => {
    render(<RequestDeleteScreen />);
    expect(screen.getByText('Fill This Form To Delete Your Account')).toBeInTheDocument();
  });
});

describe('AvatarProgress', () => {
  it('shows the photo and the completion percentage', () => {
    render(<AvatarProgress picture="https://x.test/me.png" percent={62} />);
    expect(screen.getByRole('img', { name: 'Profile photo' })).toHaveAttribute('src', 'https://x.test/me.png');
    expect(screen.getByText('62%')).toBeInTheDocument();
  });

  it('shows a placeholder and clamps the ring for out-of-range values', () => {
    const { container } = render(<AvatarProgress picture={null} percent={140} />);
    expect(screen.queryByRole('img', { name: 'Profile photo' })).toBeNull();
    const [track, fill] = container.querySelectorAll('svg[width="139"] circle');
    // A full ring fills the whole open arc, never more.
    expect(fill!.getAttribute('stroke-dasharray')).toBe(track!.getAttribute('stroke-dasharray'));
  });
});

describe('ParentLink', () => {
  const mentor = (data: unknown) =>
    http.get(`${API}/api/mentor/v1/auth/get-mentor-data`, () => HttpResponse.json({ success: true, data: { mentor_data: data } }));

  it('shows a loading line before the parent arrives', async () => {
    server.use(
      http.get(`${API}/api/mentor/v1/auth/get-mentor-data`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true, data: { mentor_data: null } });
      }),
    );
    renderWithProviders(<ParentLink />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('No parent account linked yet.')).toBeInTheDocument();
  });

  it('links a parent by email: validation, change contact, resend and verify', async () => {
    const sent: unknown[] = [];
    server.use(
      mentor(null),
      http.post(`${API}/api/mentor/v1/auth/generate-signup-otp`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(`${API}/api/mentor/v1/auth/verify-signup-otp`, () => HttpResponse.json({ success: true, data: { mentor_id: 3 } })),
    );
    renderWithProviders(<ParentLink />);
    await userEvent.click(await screen.findByRole('button', { name: /Add Parent Account/ }));
    expect(screen.getByText('Fill in the details to create a parent account')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Email' }));
    expect(screen.getByRole('radio', { name: 'Email' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.type(screen.getByPlaceholderText('First Name'), 'Priya');
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Menon');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email address'), 'priya@');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email address'), 'x.in');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));

    expect(await screen.findByText('Enter the 6-digit code sent to your Email')).toBeInTheDocument();
    expect(screen.getByText('priya@x.in')).toBeInTheDocument();
    expect(sent).toEqual([{ first_name: 'Priya', last_name: 'Menon', contact_method: 'email', contact_value: 'priya@x.in' }]);
    // Back to the form to fix the contact, then on again.
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('priya@x.in');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    const code = await screen.findByLabelText('Verification code');
    await userEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
    expect(await screen.findByRole('button', { name: 'Code sent again' })).toBeInTheDocument();
    expect(sent).toHaveLength(3);
    await userEvent.type(code, '12ab34');
    expect(code).toHaveValue('1234');
    expect(screen.getByRole('button', { name: 'Verify & Create Account' })).toBeDisabled();
    await userEvent.type(code, '56');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    expect(await screen.findByText('Account Created!')).toBeInTheDocument();
    expect(screen.getByText('Verified Email')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Account Created!')).toBeNull();
  });

  it('shows a failed OTP request and lets the student cancel', async () => {
    server.use(
      mentor(null),
      http.post(`${API}/api/mentor/v1/auth/generate-signup-otp`, () => HttpResponse.json({ success: false, message: 'Number already linked' })),
    );
    renderWithProviders(<ParentLink />);
    await userEvent.click(await screen.findByRole('button', { name: /Add Parent Account/ }));
    await userEvent.type(screen.getByPlaceholderText('First Name'), 'Priya');
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Menon');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '4567890');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Number already linked');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Add Parent Account/ })).toBeInTheDocument();
  });

  it('re-verifies a WhatsApp parent whose number changed', async () => {
    let verified: Record<string, unknown> | null = null;
    server.use(
      mentor({ account_id: 4, firstName: 'Priya', lastName: 'Menon', contactMethod: 'whatsapp', contactValue: '+919876543210' }),
      http.post(`${API}/api/mentor/v1/auth/generate-signup-otp`, () => HttpResponse.json({ success: true })),
      http.post(`${API}/api/mentor/v1/auth/verify-signup-otp`, async ({ request }) => {
        verified = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { mentor_id: 4 } });
      }),
    );
    renderWithProviders(<ParentLink />);
    expect(await screen.findByText('+919876543210')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Update the parent details below')).toBeInTheDocument();
    expect(screen.getByLabelText('Country code')).toHaveValue('91');
    const number = screen.getByLabelText('WhatsApp number');
    expect(number).toHaveValue('9876543210');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    await userEvent.clear(number);
    await userEvent.type(number, '9123456789');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByText('Enter the 6-digit code sent to your WhatsApp')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Verification code'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & Save Changes' }));
    expect(await screen.findByText('Changes Saved!')).toBeInTheDocument();
    expect(screen.getByText(/parent account has been updated successfully/)).toBeInTheDocument();
    expect(verified).toMatchObject({ contact_method: 'whatsapp', contact_value: '+919123456789', otp: '654321' });
  });

  it('keeps the Indian dial code for a short stored number', async () => {
    server.use(mentor({ account_id: 5, firstName: 'Ravi', lastName: 'K', contactMethod: 'whatsapp', contactValue: '98765' }));
    renderWithProviders(<ParentLink />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    // Up to ten digits are kept as the local number with the Indian dial code.
    expect(screen.getByLabelText('Country code')).toHaveValue('91');
    expect(screen.getByLabelText('WhatsApp number')).toHaveValue('98765');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Ravi K')).toBeInTheDocument();
  });
});
