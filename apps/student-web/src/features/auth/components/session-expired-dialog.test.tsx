import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { apiClient } from '@/shared/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { SessionExpiredDialog } from './session-expired-dialog';

type JsdomGlobal = { jsdom: { reconfigure: (options: { url: string }) => void } };

describe('SessionExpiredDialog', () => {
  it('says the session expired and sends the student to login; it cannot be dismissed', async () => {
    (globalThis as unknown as JsdomGlobal).jsdom.reconfigure({ url: 'http://localhost:3000/cbse/dashboard' });
    server.use(http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({}, { status: 401 })));
    renderWithProviders(<SessionExpiredDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await apiClient.get('/api/v4/student/account').catch(() => undefined);

    const dialog = await screen.findByRole('dialog', { name: 'Session expired' });
    expect(dialog).toHaveTextContent('Your login session has expired. Please log in again to continue.');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Session expired' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log in again' }));
    expect(navigation.replace).toHaveBeenCalledWith('/login');
  });
});
