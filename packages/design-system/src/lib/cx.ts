import { clsx, type ClassValue } from 'clsx';

/** Joins class names, skipping falsy values. */
export function cx(...values: ClassValue[]): string {
  return clsx(values);
}
