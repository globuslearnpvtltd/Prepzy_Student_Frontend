import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { apiClient, buildUrl, onApiEvent, toApiError } from './api-client';
import { ApiError, userMessage } from './errors';
import { assertOk, unwrapData } from './unwrap';

describe('apiClient', () => {
  it('sends cookies, query params and only CORS-allowed headers, and returns the JSON body', async () => {
    let seen: Request | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get(`${API}/api/things`, ({ request }) => {
        seen = request;
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(apiClient.get('/api/things', { params: { class_id: 12, empty: undefined } })).resolves.toEqual({
      ok: true,
    });
    expect(new URL(seen!.url).searchParams.get('class_id')).toBe('12');
    expect(new URL(seen!.url).searchParams.has('empty')).toBe(false);
    // The backend's CORS policy only allows Content-Type and Authorization; any other custom header
    // makes browsers block every request (this broke login once).
    const sentHeaders = Object.keys((fetchSpy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>);
    expect(sentHeaders.filter((h) => !['accept', 'content-type', 'authorization'].includes(h.toLowerCase()))).toEqual([]);
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    fetchSpy.mockRestore();
  });

  it('sends JSON bodies with a content type, and FormData without one', async () => {
    const types: (string | null)[] = [];
    server.use(
      http.post(`${API}/api/echo`, ({ request }) => {
        types.push(request.headers.get('content-type'));
        return HttpResponse.json({});
      }),
    );
    await apiClient.post('/api/echo', { a: 1 });
    await apiClient.post('/api/echo', new FormData());
    expect(types[0]).toBe('application/json');
    expect(types[1]).toMatch(/multipart\/form-data/);
  });

  it('turns backend error envelopes into ApiError', async () => {
    server.use(
      http.get(`${API}/api/limit`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'FEATURE_LIMIT_REACHED', message: 'Limit reached', requestId: 'r1' } },
          { status: 429 },
        ),
      ),
    );
    const error = await apiClient.get('/api/limit').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'FEATURE_LIMIT_REACHED',
      message: 'Limit reached',
      requestId: 'r1',
    });
  });

  it('notifies listeners on 401 and 429', async () => {
    const unauthorized = vi.fn();
    const rateLimited = vi.fn();
    const off1 = onApiEvent('unauthorized', unauthorized);
    const off2 = onApiEvent('rateLimited', rateLimited);
    server.use(
      http.get(`${API}/api/me`, () => HttpResponse.json({ message: 'Please login again' }, { status: 401 })),
      http.get(`${API}/api/busy`, () => HttpResponse.json({ message: 'Slow down' }, { status: 429 })),
    );
    await apiClient.get('/api/me').catch(() => undefined);
    await apiClient.get('/api/busy').catch(() => undefined);
    off1();
    off2();
    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(rateLimited).toHaveBeenCalledWith(expect.objectContaining({ message: 'Slow down' }));
  });

  it('reports network failures as status 0', async () => {
    server.use(http.get(`${API}/api/down`, () => HttpResponse.error()));
    const error = await apiClient.get('/api/down').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(userMessage(error)).toMatch(/offline/);
  });
});

describe('helpers', () => {
  it('builds URLs against the base', () => {
    expect(buildUrl('https://api.x', '/api/a', { q: 'b c' })).toBe('https://api.x/api/a?q=b+c');
  });

  it('reads string and flat error bodies', () => {
    expect(toApiError(500, { message: 'Boom' }).message).toBe('Boom');
    expect(toApiError(400, { error: 'Invalid Otp' }).message).toBe('Invalid Otp');
    expect(toApiError(502, 'Bad gateway').message).toBe('Bad gateway');
  });

  it('hides server error details from users', () => {
    expect(userMessage(new ApiError({ status: 500, code: 'X', message: 'SQL syntax error' }))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(userMessage(new ApiError({ status: 422, code: 'X', message: 'Invalid Otp' }))).toBe('Invalid Otp');
  });

  it('shows the "try again in a moment" message when the database is briefly unreachable', () => {
    const error = new ApiError({ status: 503, code: 'DATABASE_UNAVAILABLE', message: "We couldn't reach our servers just now." });
    expect(userMessage(error)).toBe("We couldn't reach our servers just now.");
    expect(error.isRetryable).toBe(true);
  });

  it('assertOk rejects 200 responses that carry a failure', () => {
    expect(() => assertOk({ success: false, message: 'Mobile Number Already Exists' })).toThrow(
      'Mobile Number Already Exists',
    );
    expect(() => assertOk({ error: 'Otp Expired' })).toThrow('Otp Expired');
    expect(assertOk({ success: true, error: 'ignored when success is true' })).toBeTruthy();
    expect(unwrapData({ success: true, data: [1] })).toEqual([1]);
    expect(() => unwrapData({ success: true })).toThrow(/no data/);
  });
});
