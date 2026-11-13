import type { NextConfig } from 'next';
import { legacyLearnRedirects } from './src/shared/config/legacy-learn-redirects';
import { legacyPortalRedirects } from './src/shared/config/legacy-portal-redirects';
import { legacyProfileRedirects } from './src/shared/config/legacy-profile-redirects';
import { legacyPlanRedirects } from './src/shared/config/legacy-plan-redirects';
import { legacySolverRedirects } from './src/shared/config/legacy-solver-redirects';
import { legacyTestRedirects } from './src/shared/config/legacy-test-redirects';

const nextConfig: NextConfig = {
  // Test builds (Playwright) use their own folder so they never overwrite a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // The design system ships TypeScript source; Next compiles it with the app.
  transpilePackages: ['@prepzy/design-system'],
  experimental: {
    // Not the design system: Next's barrel cache in `next dev` goes stale when it gains new exports
    // ("X is not exported from __barrel_optimize__"). It's a small local package; tree-shaking covers it.
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'tutorbucket.s3.us-east-1.amazonaws.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'staging-cms-api.prepzy.ai', pathname: '/public/images/**' },
      { protocol: 'https', hostname: 'api.cms.prepzy.ai', pathname: '/public/images/**' },
    ],
  },
  // Old test player / result and plan / checkout URLs keep working (see legacy-*-redirects.ts).
  async redirects() {
    return [...legacyTestRedirects, ...legacyLearnRedirects, ...legacyPlanRedirects, ...legacySolverRedirects, ...legacyPortalRedirects, ...legacyProfileRedirects];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
