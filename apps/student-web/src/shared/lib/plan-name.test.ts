import { describe, expect, it } from 'vitest';
import { composePlanName, type PlanGroupKey } from './plan-name';

// Made-up exam names: the rule never depends on which exam it names.
const name = (durationMonths: number, groupKey: PlanGroupKey, bundles: string[] = []) =>
  composePlanName({
    durationMonths,
    exam: groupKey === 'target_year' ? 'Exam X' : 'Board Y',
    groupKey,
    targetYear: groupKey === 'target_year' ? 2027 : null,
    bundles,
  });

describe('composePlanName (fallback for a missing display_name)', () => {
  it('competitive (target-year) exams, without and with a bundle', () => {
    expect([0, 1, 12, 6].map((months) => name(months, 'target_year'))).toEqual([
      'Basic Exam X',
      'Topper Exam X Monthly',
      'Topper Exam X 2027',
      'Topper Exam X 6 Months',
    ]);
    expect([0, 1, 12, 6].map((months) => name(months, 'target_year', ['Board Y']))).toEqual([
      'Basic Exam X + Board Y',
      'Topper Exam X + Board Y Monthly',
      'Topper Exam X 2027 + Board Y',
      'Topper Exam X + Board Y 6 Months',
    ]);
  });

  it('board (class) exams, without and with a bundle; the class is never part of the name', () => {
    expect([0, 1, 12, 3].map((months) => name(months, 'class'))).toEqual([
      'Basic Board Y',
      'Topper Board Y Monthly',
      'Topper Board Y Academic',
      'Topper Board Y 3 Months',
    ]);
    expect([0, 1, 12, 3].map((months) => name(months, 'class', ['Exam X', 'Exam Z']))).toEqual([
      'Basic Board Y + Exam X + Exam Z',
      'Topper Board Y + Exam X + Exam Z Monthly',
      'Topper Board Y Academic + Exam X + Exam Z',
      'Topper Board Y + Exam X + Exam Z 3 Months',
    ]);
  });

  it('keeps the exam name as stored and skips missing parts', () => {
    expect(composePlanName({ durationMonths: 1, exam: ' Exam-Q ', groupKey: 'target_year', bundles: [' ', 'Board-R'] })).toBe(
      'Topper Exam-Q + Board-R Monthly',
    );
    expect(composePlanName({ durationMonths: 12, exam: 'Exam-Q', groupKey: 'target_year', targetYear: null })).toBe('Topper Exam-Q');
    expect(composePlanName({ durationMonths: 0, exam: null, groupKey: 'class' })).toBe('Basic');
  });
});
