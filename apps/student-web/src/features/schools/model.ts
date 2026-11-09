import { PORTALS } from '@/shared/config/portals';

const BASE = PORTALS.schools.basePath;

/** Schools portal links always include the base path, so they work on schools.prepzy.ai and on the main host. */
export const schoolsRoutes = {
  login: () => PORTALS.schools.login,
  dashboard: () => PORTALS.schools.home,
  student: (studentId: string | number, classId?: string | number | null) =>
    `${BASE}/students/${encodeURIComponent(String(studentId))}${classId != null && classId !== '' ? `?class_id=${encodeURIComponent(String(classId))}` : ''}`,
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WeekDay {
  label: string;
  minutes: number;
}

/**
 * The last seven days ending with "Today", from the backend's day-keyed hours (`{ Mon: 1.5, …, Today: 0.8 }`),
 * converted to minutes like the previous app's chart.
 */
export function buildWeek(graph: Record<string, number>, today: Date = new Date()): WeekDay[] {
  const todayIndex = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const label = offset === 0 ? 'Today' : DAY_LABELS[(todayIndex - offset + 7) % 7]!;
    return { label, minutes: Math.round((graph[label] ?? 0) * 60) };
  });
}

/** Round axis maximum and evenly spaced ticks (0 … max) for the weekly chart. */
export function axisTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 3, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? rawStep;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

export function initials(firstName: string, lastName: string): string {
  const letters = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  return letters || '?';
}

/** "12 Jun 2025", or an em dash when unknown. */
export function formatJoined(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Share of the total as a CSS width ("43%"). */
export function share(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : '0%';
}

/** Series colours (as the previous app: orange, brand, green, violet), as background / text utility pairs. */
export const SERIES = [
  { bg: 'bg-schools-orange', text: 'text-schools-orange' },
  { bg: 'bg-brand-700', text: 'text-brand-700' },
  { bg: 'bg-success-500', text: 'text-success-500' },
  { bg: 'bg-schools-violet', text: 'text-schools-violet' },
] as const;

/** Doubts: the backend colours subjects brand, orange, green, violet and categories brand, orange, green, brand. */
export const DOUBT_SUBJECT_SERIES = [SERIES[1], SERIES[0], SERIES[2], SERIES[3]] as const;
export const DOUBT_CATEGORY_SERIES = [SERIES[1], SERIES[0], SERIES[2], SERIES[1]] as const;

export const seriesAt = <T>(series: readonly T[], index: number): T => series[index % series.length]!;
