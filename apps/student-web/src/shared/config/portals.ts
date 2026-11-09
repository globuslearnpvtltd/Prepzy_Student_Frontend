/**
 * Portal registry: the parents, schools and partners sites served by this same app.
 * Each portal is reached on its own subdomain (parents.prepzy.ai) or under its base path (/parents) and has its
 * own session cookie, set by the backend's mentor / teacher / partner login. The middleware reads this registry.
 */
export type PortalKey = 'parents' | 'schools' | 'partners';

export interface PortalConfig {
  key: PortalKey;
  label: string;
  /** First host label that selects the portal: parents.prepzy.ai → parents. */
  subdomain: string;
  /** Every page of the portal lives under this path. */
  basePath: `/${string}`;
  /** Session cookie the backend sets for this kind of user. */
  sessionCookie: string;
  login: string;
  home: string;
  /** Pages reachable without a session (login, sign-up). */
  publicPaths: readonly string[];
}

export const PORTALS = {
  parents: {
    key: 'parents',
    label: 'Parents',
    subdomain: 'parents',
    basePath: '/parents',
    sessionCookie: 'mentorAccessToken',
    login: '/parents/login',
    home: '/parents/dashboard',
    publicPaths: ['/parents/login'],
  },
  schools: {
    key: 'schools',
    label: 'Schools',
    subdomain: 'schools',
    basePath: '/schools',
    sessionCookie: 'teacherAccessToken',
    login: '/schools/login',
    home: '/schools/dashboard',
    publicPaths: ['/schools/login'],
  },
  partners: {
    key: 'partners',
    label: 'Partners',
    subdomain: 'partners',
    basePath: '/partners',
    sessionCookie: 'partnerAccessToken',
    login: '/partners/login',
    home: '/partners/dashboard',
    publicPaths: ['/partners/login', '/partners/signup'],
  },
} as const satisfies Record<PortalKey, PortalConfig>;

export const portalList: readonly PortalConfig[] = Object.values(PORTALS);

/** The portal a host name belongs to (any label matches, so parents.staging.prepzy.ai works), or null. */
export function portalForHost(host: string | null | undefined): PortalConfig | null {
  if (!host) return null;
  const labels = host.split(':')[0]!.toLowerCase().split('.');
  return portalList.find((portal) => labels.includes(portal.subdomain)) ?? null;
}

/** The portal whose pages contain this path, or null for student pages. */
export function portalForPath(pathname: string): PortalConfig | null {
  return portalList.find((portal) => pathname === portal.basePath || pathname.startsWith(`${portal.basePath}/`)) ?? null;
}

export function isPortalPublicPath(portal: PortalConfig, pathname: string): boolean {
  return portal.publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
