/**
 * The post-signup welcome page (/welcome, the previous app's /pre-dashboard) is shown once: a later visit (refresh,
 * back to the URL) goes straight to the dashboard. The previous app kept that in localStorage
 * (`first_visit_pre_dashboard`, same key so a visit there carries over), but per browser, so a new sign-up on a
 * browser that had seen it before skipped the page, and a re-render while the page loaded could skip it too.
 *
 * Now a finished sign-up decides: `startWelcomeVisit()` clears the flag and marks this page load as "show"; the
 * decision is kept in memory for the session, so remounts don't change it. Without a sign-up in this session the
 * stored flag decides, as before.
 */
export const FIRST_VISIT_KEY = 'first_visit_pre_dashboard';

let decision: 'show' | 'skip' | null = null;

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode
  }
};

/** Called when onboarding succeeds, right before opening /welcome. */
export function startWelcomeVisit(): void {
  decision = 'show';
  try {
    storage()?.setItem(FIRST_VISIT_KEY, 'true');
  } catch {
    // nothing to remember
  }
}

/** Should /welcome show its content (true) or send the student to the dashboard (false)? Stable for the session. */
export function shouldShowWelcome(): boolean {
  if (decision === null) {
    let seen = false;
    try {
      seen = !!storage()?.getItem(FIRST_VISIT_KEY);
      storage()?.setItem(FIRST_VISIT_KEY, 'true');
    } catch {
      // nothing to remember
    }
    decision = seen ? 'skip' : 'show';
  }
  return decision === 'show';
}

/** Tests only. */
export function resetWelcomeVisit(): void {
  decision = null;
}
