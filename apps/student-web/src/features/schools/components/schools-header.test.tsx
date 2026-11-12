import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { SchoolsHeader } from './schools-header';

const AUTH = `${API}/api/v4/schools/auth`;

describe('SchoolsHeader menus', () => {
  it('falls back to "Teacher", closes the account menu on an outside click and the drawer from its controls', async () => {
    server.use(http.get(`${AUTH}/me`, () => HttpResponse.json({ success: true, data: { teacher_data: null } })));
    const user = userEvent.setup();
    renderWithProviders(<SchoolsHeader />);

    const avatar = screen.getByRole('button', { name: 'Account menu' });
    await waitFor(() => expect(avatar).toHaveTextContent('T'));
    await user.click(avatar);
    expect(avatar).toHaveAttribute('aria-expanded', 'true');
    await user.click(document.body);
    expect(avatar).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(drawer).getByText('Teacher')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Close menu' }));
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(within(drawer).getByRole('link', { name: /Dashboard/ }));
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });
});
