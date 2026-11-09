import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { legacyPortalRedirects } from './legacy-portal-redirects';
import { isPortalPublicPath, PORTALS, portalForHost, portalForPath, portalList } from './portals';

function run(url: string, cookies: Record<string, string> = {}) {
  const request = new NextRequest(new URL(url));
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  const response = middleware(request);
  return {
    location: response.headers.get('location'),
    rewrite: response.headers.get('x-middleware-rewrite'),
  };
}

describe('portal registry', () => {
  it('finds the portal from any host label', () => {
    expect(portalForHost('parents.prepzy.ai')?.key).toBe('parents');
    expect(portalForHost('schools.staging.prepzy.ai')?.key).toBe('schools');
    expect(portalForHost('partners.localhost:3000')?.key).toBe('partners');
    expect(portalForHost('app.prepzy.ai')).toBeNull();
    expect(portalForHost(null)).toBeNull();
  });

  it('finds the portal from its base path', () => {
    expect(portalForPath('/parents/dashboard')?.key).toBe('parents');
    expect(portalForPath('/parents')?.key).toBe('parents');
    expect(portalForPath('/parentsx')).toBeNull();
    expect(portalForPath('/cbse/dashboard')).toBeNull();
  });

  it('gives each portal its own cookie, login and home under its base path', () => {
    expect(new Set(portalList.map((p) => p.sessionCookie)).size).toBe(portalList.length);
    for (const portal of portalList) {
      expect(portal.login.startsWith(`${portal.basePath}/`)).toBe(true);
      expect(portal.home.startsWith(`${portal.basePath}/`)).toBe(true);
      expect(isPortalPublicPath(portal, portal.login)).toBe(true);
      expect(isPortalPublicPath(portal, portal.home)).toBe(false);
    }
    expect(isPortalPublicPath(PORTALS.partners, '/partners/signup')).toBe(true);
  });
});

describe('middleware: portals on their subdomain', () => {
  it('serves short URLs from the portal folder (rewrite) when signed in', () => {
    const res = run('https://parents.prepzy.ai/dashboard', { mentorAccessToken: 't' });
    expect(res.location).toBeNull();
    expect(res.rewrite).toBe('https://parents.prepzy.ai/parents/dashboard');
  });

  it('sends signed-out visitors to the portal login, and signed-in visitors away from it', () => {
    expect(run('https://schools.prepzy.ai/dashboard').location).toBe('https://schools.prepzy.ai/schools/login');
    expect(run('https://schools.prepzy.ai/login', { teacherAccessToken: 't' }).location).toBe(
      'https://schools.prepzy.ai/schools/dashboard',
    );
    expect(run('https://partners.prepzy.ai/').location).toBe('https://partners.prepzy.ai/partners/login');
  });

  it('uses only the portal cookie (a student session does not open the parents portal)', () => {
    expect(run('https://parents.prepzy.ai/dashboard', { accessToken: 'student' }).location).toBe(
      'https://parents.prepzy.ai/parents/login',
    );
  });

  it('keeps public portal pages reachable', () => {
    const res = run('https://partners.prepzy.ai/signup');
    expect(res.location).toBeNull();
    expect(res.rewrite).toBe('https://partners.prepzy.ai/partners/signup');
  });
});

describe('middleware: portals by base path on the main host', () => {
  it('guards portal pages with the portal cookie', () => {
    expect(run('https://app.prepzy.ai/parents/dashboard').location).toBe('https://app.prepzy.ai/parents/login');
    const ok = run('https://app.prepzy.ai/parents/dashboard', { mentorAccessToken: 't' });
    expect(ok.location).toBeNull();
    expect(ok.rewrite).toBeNull();
  });

  it('does not treat portal pages as student pages', () => {
    // No student `next=` login redirect for portal paths.
    expect(run('https://app.prepzy.ai/partners/payouts').location).toBe('https://app.prepzy.ai/partners/login');
  });

  it('leaves student routing unchanged', () => {
    expect(run('https://app.prepzy.ai/cbse/dashboard').location).toBe(
      'https://app.prepzy.ai/login?next=%2Fcbse%2Fdashboard',
    );
  });
});

describe('legacy portal redirects', () => {
  it('maps every old portal page to its new path', () => {
    const map = Object.fromEntries(legacyPortalRedirects.map((r) => [r.source, r.destination]));
    expect(map['/parents-login']).toBe('/parents/login');
    expect(map['/schools-student/:studentId']).toBe('/schools/students/:studentId');
    expect(map['/partner-bank-details']).toBe('/partners/bank-details');
    for (const { destination } of legacyPortalRedirects) expect(portalForPath(destination)).not.toBeNull();
  });
});
