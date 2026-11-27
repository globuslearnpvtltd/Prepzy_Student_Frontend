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
    expect(run('/login', { prepzy_student_test_access_token: 't', prepzy_exam: 'neet' })).toBe('https://app.prepzy.ai/neet/dashboard');
    expect(run('/login', { prepzy_student_test_access_token: 't' })).toBe('https://app.prepzy.ai/cbse/dashboard');
    expect(run('/login?exam=neet-ug', { prepzy_student_test_access_token: 't' })).toBe('https://app.prepzy.ai/neet/dashboard');
    // Any exam's slice works (the exam layout 404s one that is not active); junk falls back to the default exam.
    expect(run('/login', { prepzy_student_test_access_token: 't', prepzy_exam: 'jee-main' })).toBe('https://app.prepzy.ai/jee-main/dashboard');
    expect(run('/login', { prepzy_student_test_access_token: 't', prepzy_exam: '../x' })).toBe('https://app.prepzy.ai/cbse/dashboard');
  });

  it('keeps onboarding steps reachable while the session is being created', () => {
    expect(run('/setup', { prepzy_student_test_access_token: 't' })).toBeNull();
    expect(run('/exam-selection', { prepzy_student_test_access_token: 't' })).toBeNull();
  });

  it('routes the root URL', () => {
    expect(run('/')).toBe('https://app.prepzy.ai/login');
    expect(run('/', { prepzy_student_test_access_token: 't', prepzy_exam: 'cbse' })).toBe('https://app.prepzy.ai/cbse/dashboard');
  });

  it('lets signed-in students through to app pages', () => {
    expect(run('/cbse/dashboard', { prepzy_student_test_access_token: 't' })).toBeNull();
    // the previous app's cookie still counts until the backend swaps it for this app's own
    expect(run('/cbse/dashboard', { accessToken: 't' })).toBeNull();
    expect(run('/login', { accessToken: 't' })).toBe('https://app.prepzy.ai/cbse/dashboard');
    // this app's previous name counts until the backend renames it
    expect(run('/cbse/dashboard', { prepzyAccessToken: 't' })).toBeNull();
    // the single name of 2026-11-27 too; another environment's or the CMS's cookie does not
    expect(run('/cbse/dashboard', { prepzy_student_access_token: 't' })).toBeNull();
    expect(run('/cbse/dashboard', { prepzy_student_prod_access_token: 't', prepzy_cms_access_token: 't' })).not.toBeNull();
  });
});
