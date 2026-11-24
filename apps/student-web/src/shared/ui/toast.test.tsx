import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { AppToast, notify } from './toast';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(() => 'id-1'), dismiss: vi.fn() } }));

const rendered = () => {
  const [renderToast, options] = vi.mocked(toast.custom).mock.calls.at(-1)!;
  return { view: render((renderToast as (id: string) => React.ReactElement)('t1')), options };
};

describe('notify (the app toast)', () => {
  beforeEach(() => vi.mocked(toast.custom).mockClear());

  it('shows the dark toast with a Close button (no Undo), bottom on phones', async () => {
    notify.success('Photo updated');
    const { view, options } = rendered();
    expect(options).toMatchObject({ position: 'bottom-center', duration: 4000, unstyled: true });
    expect(screen.getByRole('status')).toHaveTextContent('Photo updated');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(toast.dismiss).toHaveBeenCalledWith('t1');
    view.unmount();
  });

  it('errors stay longer and are alerts; info and dismiss work; desktop uses the top and its own wording', () => {
    notify.error('Could not save');
    let { view, options } = rendered();
    expect(options).toMatchObject({ duration: 6000 });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    view.unmount();

    notify.info('Showing CBSE in हिन्दी', { duration: 1000 });
    ({ view, options } = rendered());
    expect(options).toMatchObject({ duration: 1000 });
    expect(view.container.querySelector('[data-kind="info"]')).not.toBeNull();
    view.unmount();

    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    notify.success('Saved', { desktopMessage: 'Your profile is saved' });
    ({ view, options } = rendered());
    expect(options).toMatchObject({ position: 'top-center' });
    expect(view.container).toHaveTextContent('Your profile is saved');
    view.unmount();
    vi.unstubAllGlobals();

    notify.dismiss('x');
    expect(toast.dismiss).toHaveBeenCalledWith('x');
  });

  it('AppToast renders one icon per kind', () => {
    const { container } = render(<AppToast kind="error" message="m" onClose={() => undefined} />);
    expect(container.querySelector('.stroke-danger-light')).not.toBeNull();
  });
});
