import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_EXAM, findExam } from '@/shared/config/exams';
import {
  isPortalPublicPath,
  portalForHost,
  portalForPath,
  type PortalConfig,
} from '@/shared/config/portals';
import { isPublicPath, routes } from '@/shared/config/routes';

/** Session cookie set by the backend on student login / onboarding. */
export const SESSION_COOKIE = 'accessToken';
/** Non-sensitive cookie the app sets to remember the student's exam (see features/auth/device.ts). */
const EXAM_COOKIE = 'prepzy_exam';

function homeFor(request: NextRequest): string {
  // Old links use either the slug (?exam=neet) or the backend slice (?exam=neet-ug).
  const fromQuery = findExam(request.nextUrl.searchParams.get('exam'));
  const fromCookie = findExam(request.cookies.get(EXAM_COOKIE)?.value);
  return routes.dashboard((fromQuery ?? fromCookie)?.slug ?? DEFAULT_EXAM);
}

/**
 * Parents / schools / partners. On the portal's subdomain, `/dashboard` is served from `/parents/dashboard`
 * (rewrite, the address bar keeps the short URL); links that already include the base path work on any host.
 */
function portalResponse(request: NextRequest, portal: PortalConfig, onSubdomain: boolean) {
  const { pathname, search } = request.nextUrl;
  const path = pathname.startsWith(portal.basePath) ? pathname : `${portal.basePath}${pathname === '/' ? '' : pathname}`;
  const signedIn = request.cookies.has(portal.sessionCookie);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  if (path === portal.basePath) return redirect(signedIn ? portal.home : portal.login);
  if (isPortalPublicPath(portal, path)) {
    if (signedIn) return redirect(portal.home);
  } else if (!signedIn) {
    return redirect(portal.login);
  }
  if (onSubdomain && path !== pathname) {
    return NextResponse.rewrite(new URL(`${path}${search}`, request.url));
  }
  return NextResponse.next();
}

/**
 * Coarse routing only: signed-out users go to login, signed-in users skip the auth pages.
 * Real authorisation stays on the backend; the exam layout also checks the student's purchased exams.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hostPortal = portalForHost(request.headers.get('host') ?? request.nextUrl.host);
  const pathPortal = portalForPath(pathname);
  if (hostPortal) return portalResponse(request, hostPortal, true);
  if (pathPortal) return portalResponse(request, pathPortal, false);

  const signedIn = request.cookies.has(SESSION_COOKIE);
  const redirect = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (pathname === '/') return redirect(signedIn ? homeFor(request) : routes.login());

  // /setup and /exam-selection happen before the backend issues a session, so they stay reachable.
  if (isPublicPath(pathname)) {
    const isOnboardingStep = pathname.startsWith('/setup') || pathname.startsWith('/exam-selection');
    return signedIn && !isOnboardingStep ? redirect(homeFor(request)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL(routes.login(), request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and any file with an extension (images, fonts, favicon …).
  matcher: ['/((?!_next/|api/|.*\\.[\\w]+$).*)'],
};
