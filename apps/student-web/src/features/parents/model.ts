/** Pure helpers for the parents portal (no React, no network). */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface WeekBar {
  name: string;
  minutes: number;
}

/** The last seven days ending on "Today", as the backend keys them; graph values are hours, bars are minutes. */
export function buildWeek(graph: Record<string, number>, now = new Date()): WeekBar[] {
  const today = now.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    const name = back === 0 ? 'Today' : DAY_LABELS[(today - back + 7) % 7]!;
    return { name, minutes: Math.round((graph[name] ?? 0) * 60) };
  });
}

/** Axis ticks for the week chart: 0 and four equal steps up to a round maximum. */
export function weekTicks(maxMinutes: number): number[] {
  const steps = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1440];
  const step = steps.find((s) => s * 4 >= maxMinutes) ?? Math.ceil(maxMinutes / 4);
  return [0, step, step * 2, step * 3, step * 4];
}

export const fullName = (person: { firstName: string; lastName: string }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

/** "Ravi Kumar" → "RK" (the previous app always showed "AS"). */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return letters || '?';
}

/** "14 Jun 2025", or an em dash when unknown. */
export function formatSince(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 54 → "54 Min", 375 → "6h 15 Min", 120 → "2h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m} Min` : `${h}h`;
}

/** Share of the total as a CSS width. */
export const share = (count: number, total: number) => `${total > 0 ? Math.round((count / total) * 100) : 0}%`;

/** Bar colours the previous app cycled through by position (orange, brand, green, violet). */
export const PORTAL_COLORS = [
  'var(--color-schools-orange)',
  'var(--color-brand-700)',
  'var(--color-success-500)',
  'var(--color-schools-violet)',
] as const;
export const colorAt = (index: number) => PORTAL_COLORS[index % PORTAL_COLORS.length]!;
