import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';

/**
 * Every main page fits the screen: no sideways page scroll on a phone, a tablet or a desktop, and the
 * viewport meta tag (from the root layout's `viewport` export) is on every route.
 *
 * Runs in the desktop project only: with mobile emulation Chrome zooms out to fit wide content, which hides
 * the very overflow this spec looks for. The widths below cover phone and tablet sizes instead.
 */

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

type Exam = 'board' | 'competitive';

/** The same pages for a board exam (CBSE) and a competitive one (NEET), with the shared visual mocks. */
const studentPages = (exam: string, extra: string[]) => [
  `/${exam}/dashboard`,
  `/${exam}/learn`,
  `/${exam}/notes`,
  `/${exam}/tests`,
  `/${exam}/tests/mock`,
  `/${exam}/pyq-library`,
  `/${exam}/custom-test`,
  `/${exam}/study-plan`,
  `/${exam}/diagnostic`,
  `/${exam}/refer-and-earn`,
  `/${exam}/profile`,
  '/manage-plans',
  `/purchase?exam=${exam}`,
  ...extra,
];

const ROUTES: { path: string; exam: Exam | null; slug?: string }[] = [
  ...studentPages('cbse', ['/cbse/notes/5', '/cbse/assessments', '/cbse/syllabus', '/cbse/syllabus?subject_id=3', '/cbse/pyq-trends?subject_id=3']).map((path) => ({ path, exam: 'board' as const, slug: 'cbse' })),
  ...studentPages('neet', ['/neet/learn/214/341/study-notes?from=notes']).map((path) => ({
    path,
    exam: 'competitive' as const,
    slug: 'neet',
  })),
  // Signed out: sign-in and onboarding.
  ...['/login', '/get-started', '/verify-otp?flow=login', '/exam-selection', '/setup'].map((path) => ({
    path,
    exam: null,
  })),
];

/** Widest elements that stick out past the right edge, to say which part of the page overflows. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const culprits: string[] = [];
    if (scrollWidth > viewport) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.right <= viewport + 1) continue;
        // Inside something that clips or scrolls sideways: the page itself doesn't grow.
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible' && p.getBoundingClientRect().right <= viewport + 1) {
            clipped = true;
            break;
          }
        }
        if (clipped) continue;
        const cls = typeof el.className === 'string' ? el.className.slice(0, 80) : '';
        culprits.push(`<${el.tagName.toLowerCase()} class="${cls}"> right=${Math.round(rect.right)}`);
        if (culprits.length >= 5) break;
      }
    }
    return { viewport, scrollWidth, culprits };
  });
}

test.describe('viewport', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'widths are set explicitly; see the note at the top');
  });

  for (const route of ROUTES) {
    test(`${route.slug ?? 'signed out'} ${route.path} fits 390 / 768 / 1440 px`, async ({ page, context }) => {
      test.setTimeout(90_000); // three page loads
      if (route.exam) {
        await signIn(context, route.slug);
        await mockStudentApi(page, route.exam);
      } else {
        await mockStudentApi(page, 'board');
      }

      for (const size of WIDTHS) {
        await page.setViewportSize(size);
        await page.goto(route.path);
        // Some pages poll; don't wait for a quiet network forever.
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
        // Let client-side data and layout settle (skeletons → content).
        await page.waitForTimeout(500);

        const meta = page.locator('meta[name="viewport"]');
        await expect(meta).toHaveCount(1);
        await expect(meta).toHaveAttribute('content', /width=device-width/);
        await expect(meta).toHaveAttribute('content', /initial-scale=1/);
        await expect(meta).toHaveAttribute('content', /viewport-fit=cover/);

        const result = await overflow(page);
        expect
          .soft(result.scrollWidth, `${route.path} at ${size.width}px overflows sideways:\n${result.culprits.join('\n')}`)
          .toBeLessThanOrEqual(result.viewport);
      }
    });
  }
});
