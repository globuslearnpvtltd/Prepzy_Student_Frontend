import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { CrumbTrail, crumbsToHide, type TrailCrumb } from './crumb-trail';

const crumbs: TrailCrumb[] = [
  { label: 'Learn', href: '/cbse/learn' },
  { label: 'Science' },
  { label: 'Ch 1: Light', href: '/cbse/learn/1' },
  { label: 'Reflection of light' },
];

const trail = () => (
  <CrumbTrail
    crumbs={crumbs}
    separator={<span>›</span>}
    renderCrumb={(crumb, { last }) => (crumb.href && !last ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>)}
  />
);

/** Fakes the layout: each crumb 100px, separators 10px, the "…" button 24px, the space for the trail `space` px. */
const layout = (space: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const part = this.dataset.part;
    const width = part === 'crumb' ? 100 : part === 'separator' ? 10 : part === 'dots' ? 24 : this.matches('div.flex-col') ? space : 0;
    return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });

afterEach(() => vi.restoreAllMocks());

describe('crumbsToHide', () => {
  const sizes = { items: [100, 100, 100, 100], separator: 10, dots: 24, gap: 0 };
  it('hides nothing when everything fits', () => expect(crumbsToHide({ ...sizes, available: 430 })).toBe(0));
  it('hides the fewest leading crumbs that make the rest fit with the "…" button', () => {
    expect(crumbsToHide({ ...sizes, available: 429 })).toBe(1);
    expect(crumbsToHide({ ...sizes, available: 250 })).toBe(2);
  });
  it('always keeps the current crumb', () => expect(crumbsToHide({ ...sizes, available: 10 })).toBe(3));
  it('counts the gaps', () => expect(crumbsToHide({ ...sizes, gap: 8, available: 430 })).toBe(1));
});

describe('CrumbTrail', () => {
  it('shows every crumb when they fit', () => {
    layout(1000);
    render(trail());
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/cbse/learn');
    expect(within(nav).queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
  });

  it('folds the leading crumbs into "…", whose menu opens them', async () => {
    layout(250);
    render(trail());
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Reflection of light')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Ch 1: Light' })).toBeInTheDocument();

    const dots = within(nav).getByRole('button', { name: 'Show 2 more' });
    await userEvent.click(dots);
    expect(dots).toHaveAttribute('aria-expanded', 'true');
    const menu = within(nav).getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Learn' })).toHaveAttribute('href', '/cbse/learn');
    expect(within(menu).getByRole('menuitem', { name: 'Science' })).toHaveAttribute('aria-disabled');

    await userEvent.keyboard('{Escape}');
    expect(within(nav).queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(dots);
    await userEvent.click(document.body);
    expect(within(nav).queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(dots);
    await userEvent.click(within(nav).getByRole('menuitem', { name: 'Learn' }));
    expect(within(nav).queryByRole('menu')).not.toBeInTheDocument();
  });
});
