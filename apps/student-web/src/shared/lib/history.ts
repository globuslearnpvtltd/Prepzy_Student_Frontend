/**
 * Whether the tab has an earlier page of this site to go back to (Navigation API: only same-origin entries count).
 * False where the API is missing (Safari, Firefox) or the page was opened directly, so callers fall back to a link.
 */
export function canGoBackInApp(): boolean {
  return (
    typeof window !== 'undefined' && (window as { navigation?: { canGoBack?: boolean } }).navigation?.canGoBack === true
  );
}
