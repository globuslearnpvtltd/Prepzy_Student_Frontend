import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function run(path: string, cookies: Record<string, string> = {}) {
  const request = new NextRequest(new URL(path, 'https://app.prepzy.ai'));
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  const response = middleware(request);
  return response.headers.get('location');
}

describe('middleware', () => {
  it('sends signed-out visitors of protected pages to login, remembering where they were going', () => {
    expect(run('/neet/tests')).toBe('https://app.prepzy.ai/login?next=%2Fneet%2Ftests');
  });

  it('lets signed-out visitors use the auth pages', () => {
    expect(run('/login')).toBeNull();
    expect(run('/get-started')).toBeNull();
  });

  it('sends signed-in students away from login to their exam', () => {
    expect(run('/login', { accessToken: 't', prepzy_exam: 'neet' })).toBe('https://app.prepzy.ai/neet/dashboard');
    expect(run('/login', { accessToken: 't' })).toBe('https://app.prepzy.ai/cbse/dashboard');
    expect(run('/login?exam=neet-ug', { accessToken: 't' })).toBe('https://app.prepzy.ai/neet/dashboard');
  });

  it('keeps onboarding steps reachable while the session is being created', () => {
    expect(run('/setup', { accessToken: 't' })).toBeNull();
    expect(run('/exam-selection', { accessToken: 't' })).toBeNull();
  });

  it('routes the root URL', () => {
    expect(run('/')).toBe('https://app.prepzy.ai/login');
    expect(run('/', { accessToken: 't', prepzy_exam: 'cbse' })).toBe('https://app.prepzy.ai/cbse/dashboard');
  });

  it('lets signed-in students through to app pages', () => {
    expect(run('/cbse/dashboard', { accessToken: 't' })).toBeNull();
  });
});
