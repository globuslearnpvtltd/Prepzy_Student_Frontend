/** How an exam's variants are picked: by class (with streams), or by target year. From the catalog's `group_key`. */
export type PlanGroupKey = 'class' | 'target_year';

export interface PlanNameParts {
  durationMonths: number;
  /** The exam name from the API (exam_table.exam_name, as stored). */
  exam: string | null | undefined;
  /** 'target_year' names a 12-month plan by its year, 'class' by "Academic". */
  groupKey: PlanGroupKey;
  /** Target-year exams: the year a 12-month plan targets. */
  targetYear?: number | string | null;
  /** Names of the exams a combo plan bundles (" + CBSE"). */
  bundles?: readonly string[];
}

const clean = (value: unknown) => (value == null ? '' : String(value).trim());
const words = (...parts: unknown[]) => parts.map(clean).filter(Boolean).join(' ');

/**
 * The plan name, by the same rule as the server's `display_name` (only used when the API sends none):
 *   0 months    Basic {exam}{ + bundles}
 *   1 month     Topper {exam}{ + bundles} Monthly
 *   12 months   Topper {exam} {target year}{ + bundles} (target-year exams) · Topper {exam} Academic{ + bundles} (class exams)
 *   n months    Topper {exam}{ + bundles} {n} Months
 * The class is not part of the name; every part comes from the API.
 */
export function composePlanName({ durationMonths, exam, groupKey, targetYear, bundles = [] }: PlanNameParts): string {
  const related = bundles.map(clean).filter(Boolean);
  const combo = related.length ? ` + ${related.join(' + ')}` : '';
  const months = Number(durationMonths);
  if (months === 0) return `${words('Basic', exam)}${combo}`;
  if (months === 1) return words(`${words('Topper', exam)}${combo}`, 'Monthly');
  if (months === 12) return `${words('Topper', exam, groupKey === 'target_year' ? targetYear : 'Academic')}${combo}`;
  return words(`${words('Topper', exam)}${combo}`, `${months} Months`);
}
