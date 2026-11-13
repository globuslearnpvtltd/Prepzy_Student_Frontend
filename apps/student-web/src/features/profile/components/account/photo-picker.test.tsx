import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { profileApi, toProfile } from '../../api';
import { accountRow, fail, ok } from '../../test-fixtures';
import { checkPhoto, formatSize, PhotoPicker } from './photo-picker';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const PHOTO_URL = 'https://cdn.test/me.png';
const noPhoto = toProfile(accountRow);
const withPhoto = toProfile({ ...accountRow, profile_picture: PHOTO_URL });

const jpeg = (name = 'me.jpg', bytes = 2048) => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
const fine = vi.fn(async () => null);

/** Renders the last profile toast so its text and Undo button can be used. */
const lastToast = () => {
  const calls = vi.mocked(toast.custom).mock.calls;
  const render = calls.at(-1)?.[0] as ((id: string) => React.ReactElement) | undefined;
  if (!render) return null;
  return renderWithProviders(render('t1'));
};

describe('checkPhoto', () => {
  const size = (width: number, height: number) => async () => ({ width, height });

  it('explains what is wrong with a file, or null when it is fine', async () => {
    expect(await checkPhoto(new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }))).toBe(
      '6 MB',
    );
    expect(await checkPhoto(new File(['x'], 'me.heic', { type: 'image/heic' }))).toBe('a HEIC file');
    expect(await checkPhoto(new File(['x'], 'photo', { type: '' }))).toBe('not a JPG or PNG');
    expect(await checkPhoto(jpeg(), async () => null)).toBe('not a photo we can open');
    expect(await checkPhoto(jpeg(), size(600, 900))).toBe('600 × 900');
    expect(await checkPhoto(jpeg(), size(800, 800))).toBeNull();
  });

  it('formats file sizes', () => {
    expect(formatSize(100)).toBe('1 KB');
    expect(formatSize(300 * 1024)).toBe('300 KB');
    expect(formatSize(2 * 1024 * 1024)).toBe('2 MB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  describe('reading the image size', () => {
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, Image: window.Image };
    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      window.Image = original.Image;
    });

    const fakeImage = (outcome: 'load' | 'error', width = 1000, height = 1000) => {
      URL.createObjectURL = vi.fn(() => 'blob:photo');
      URL.revokeObjectURL = vi.fn();
      window.Image = class {
        naturalWidth = width;
        naturalHeight = height;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()));
        }
      } as unknown as typeof window.Image;
    };

    it('reads the natural size and frees the object URL', async () => {
      fakeImage('load', 640, 480);
      expect(await checkPhoto(jpeg())).toBe('640 × 480');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    });

    it('treats an image the browser cannot decode as unreadable', async () => {
      fakeImage('error');
      expect(await checkPhoto(jpeg())).toBe('not a photo we can open');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    });

    it('cannot read the size without object URLs', async () => {
      // @ts-expect-error jsdom may lack it; the picker then can't measure the photo
      URL.createObjectURL = undefined;
      expect(await checkPhoto(jpeg())).toBe('not a photo we can open');
    });
  });
});

/**
 * jsdom's File can't go through Node's fetch as multipart, so the picker tests stub the upload call itself
 * (api.test.ts covers the request). The stub honours the abort signal like fetch does.
 */
const stubUpload = (result: () => Promise<{ picture: string | null; completion: number }>) => {
  const names: string[] = [];
  const spy = vi.spyOn(profileApi, 'uploadPhoto').mockImplementation(
    (file, signal) =>
      new Promise((resolve, reject) => {
        names.push(file.name);
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        result().then(resolve, reject);
      }),
  );
  return { spy, names };
};

describe('PhotoPicker', () => {
  const user = () => userEvent.setup({ applyAccept: false });
  afterEach(() => vi.restoreAllMocks());

  it('opens the photo sheet with take / choose and closes on Cancel', async () => {
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const sheet = screen.getByRole('dialog', { name: 'Profile photo' });
    expect(within(sheet).getByRole('button', { name: 'Take a photo' })).toBeInTheDocument();
    // No photo yet, so nothing to remove.
    expect(within(sheet).queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();

    const camera = screen.getByLabelText('Take a photo', { selector: 'input' });
    const gallery = screen.getByLabelText('Choose a photo');
    const cameraClick = vi.spyOn(camera, 'click');
    const galleryClick = vi.spyOn(gallery, 'click');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Take a photo' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Choose from gallery' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Upload new photo' }));
    expect(cameraClick).toHaveBeenCalledTimes(1);
    expect(galleryClick).toHaveBeenCalledTimes(2);

    await userEvent.click(within(sheet).getAllByRole('button', { name: 'Cancel' })[0]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the sheet with Escape', async () => {
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores an empty file selection', async () => {
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    const input = screen.getByLabelText('Choose a photo') as HTMLInputElement;
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(fine).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains a bad file and offers another pick', async () => {
    const upload = vi.fn();
    server.use(http.put(`${API}/api/v4/student/account/photo`, upload));
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={async () => '600 × 600'} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg('small.jpg'));

    const sheet = await screen.findByRole('dialog', { name: 'This photo can’t be used' });
    expect(within(sheet).getByText('It’s 600 × 600. Pick a JPG or PNG under 5 MB, at least 800 × 800.')).toBeInTheDocument();
    expect(
      within(sheet).getByText('small.jpg is 600 × 600. Pick a JPG or PNG under 5 MB, at least 800 × 800.'),
    ).toBeInTheDocument();
    const galleryClick = vi.spyOn(screen.getByLabelText('Choose a photo'), 'click');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Choose another' }));
    expect(galleryClick).toHaveBeenCalled();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads with a progress bar, then offers Undo that removes the new photo', async () => {
    let removed = false;
    const { names } = stubUpload(async () => {
      await delay(700);
      return { picture: 'https://cdn.test/new.png', completion: 70 };
    });
    server.use(
      http.delete(`${API}/api/v4/student/account/photo`, () => {
        removed = true;
        return ok({ completion_percentage: 60 });
      }),
    );
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg('me.jpg', 300 * 1024));

    const sheet = await screen.findByRole('dialog', { name: 'Uploading your photo' });
    expect(within(sheet).getByText('me.jpg · 300 KB · 0%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDisabled();
    // The bar eases forward while the upload runs.
    await waitFor(() => expect(within(sheet).queryByText('me.jpg · 300 KB · 0%')).not.toBeInTheDocument());
    // The uploading sheet can't be dismissed.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Uploading your photo' })).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
    expect(names).toEqual(['me.jpg']);
    const done = lastToast()!;
    expect(done.container).toHaveTextContent('Photo updated');
    await userEvent.click(within(done.container).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(removed).toBe(true));
    await waitFor(() => expect(lastToast()?.container).toHaveTextContent('Photo restored'));
  });

  it('Undo re-uploads the previous photo', async () => {
    const { names: uploads } = stubUpload(async () => ({ picture: PHOTO_URL, completion: 70 }));
    server.use(
      http.get(PHOTO_URL, () => new HttpResponse(new Blob(['png'], { type: 'image/png' }))),
    );
    renderWithProviders(<PhotoPicker profile={withPhoto} checkFile={fine} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg('new.jpg'));
    await waitFor(() => expect(uploads).toEqual(['new.jpg']));
    await waitFor(() => expect(lastToast()?.container).toHaveTextContent('Photo updated'));

    await userEvent.click(within(lastToast()!.container).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(uploads).toEqual(['new.jpg', 'profile.jpg']));
    await waitFor(() => expect(lastToast()?.container).toHaveTextContent('Photo restored'));
  });

  it('says so when the previous photo can’t be restored', async () => {
    stubUpload(async () => ({ picture: PHOTO_URL, completion: 70 }));
    server.use(http.get(PHOTO_URL, () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<PhotoPicker profile={withPhoto} checkFile={fine} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg());
    await waitFor(() => expect(lastToast()?.container).toHaveTextContent('Photo updated'));
    await userEvent.click(within(lastToast()!.container).getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(lastToast()?.container).toHaveTextContent('Couldn’t undo. Please pick the photo again.'),
    );
  });

  it('cancelling the upload closes the sheet without an error', async () => {
    const { spy } = stubUpload(() => new Promise(() => undefined));
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg());
    const sheet = await screen.findByRole('dialog', { name: 'Uploading your photo' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel upload' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(spy.mock.calls[0]![1]!.aborted).toBe(true);
    expect(toast.custom).not.toHaveBeenCalled();
  });

  it('shows an error toast when the upload fails', async () => {
    stubUpload(async () => {
      throw new Error('HTTP 500');
    });
    renderWithProviders(<PhotoPicker profile={noPhoto} checkFile={fine} />);
    await user().upload(screen.getByLabelText('Choose a photo'), jpeg());
    await waitFor(() =>
      expect(lastToast()?.container).toHaveTextContent('Couldn’t upload your photo. Please try again.'),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes the photo, or says so when it can’t', async () => {
    server.use(http.delete(`${API}/api/v4/student/account/photo`, () => fail(500, 'INTERNAL')));
    renderWithProviders(<PhotoPicker profile={withPhoto} checkFile={fine} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    // Desktop copy of the button (the phone list has its own).
    const buttons = within(screen.getByRole('dialog', { name: 'Profile photo' })).getAllByRole('button', {
      name: 'Remove photo',
    });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]!);
    await waitFor(() =>
      expect(lastToast()?.container).toHaveTextContent('Couldn’t remove your photo. Please try again.'),
    );
  });
});
