const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₹1,499" — plan prices are whole rupees. */
export const formatInr = (value: number) => whole.format(value);

/** "₹1,768.82" — invoices keep paise. */
export const formatInrExact = (value: number) => exact.format(value);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** "4 Sept 2026" — the purchase page's date style. */
export const formatPlanDate = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

/** "04 Sep 2026", or the raw value when it isn't a date (never "NaN"). */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '—';
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${String(date.getDate()).padStart(2, '0')} ${month} ${date.getFullYear()}`;
}

/** "4 Sept 2026" style for the board manage page (en-GB). */
export function formatGbDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** "4 Sept 2026" style for invoices (en-IN). */
export function formatInDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const longDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
