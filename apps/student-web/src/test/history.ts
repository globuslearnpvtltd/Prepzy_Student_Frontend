import { navigation } from './setup';

const current = () => `${navigation.pathname}${navigation.searchParams.size ? `?${navigation.searchParams}` : ''}`;

/**
 * Makes the router mock behave like the browser's history: push / replace / back change `navigation.pathname`
 * and `navigation.searchParams` (read by the next render). The page shown when the first navigation happens is
 * the first entry, so tests can still set the URL after calling this. Returns the entries.
 */
export function simulateHistory() {
  const entries: string[] = [];
  const show = (url: string) => {
    const parsed = new URL(url, 'http://app.test');
    navigation.pathname = parsed.pathname;
    navigation.searchParams = new URLSearchParams(parsed.search);
  };
  const start = () => {
    if (entries.length === 0) entries.push(current());
  };
  navigation.push.mockImplementation((url: string) => {
    start();
    entries.push(url);
    show(url);
  });
  navigation.replace.mockImplementation((url: string) => {
    start();
    entries[entries.length - 1] = url;
    show(url);
  });
  navigation.back.mockImplementation(() => {
    start();
    if (entries.length > 1) entries.pop();
    show(entries[entries.length - 1]!);
  });
  return entries;
}

/** Puts the router mock back to plain spies. */
export function resetHistory() {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.back.mockReset();
}
