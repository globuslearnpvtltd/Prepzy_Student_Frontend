import { availableTestTypes } from '@/features/exam-engine';
import { examList, findExam, getExam, hasTestType, REFERENCE } from './exams';
import {
  isActivePath,
  isNavLocked,
  NAVIGATION,
  navigationFor,
  SECTIONS,
  sectionTitle,
} from './navigation';
import { isPublicPath, isSectionKey, routes, SECTION_KEYS } from './routes';

describe('exam registry', () => {
  it('finds exams by slug, backend slice, name or id', () => {
    expect(getExam('neet')?.examSlice).toBe('neet-ug');
    expect(findExam('neet-ug')?.slug).toBe('neet');
    expect(findExam('NEET-UG')?.slug).toBe('neet');
    expect(findExam('CBSE')?.slug).toBe('cbse');
    expect(findExam('jee')).toBeNull();
    expect(getExam('unknown')).toBeNull();
    expect(getExam('toString')).toBeNull();
  });

  it.each(examList)('$label: every listed test type has a working adapter', (exam) => {
    expect(availableTestTypes(exam)).toEqual(exam.testTypes);
  });

  it('has a reference category without an exam', () => {
    expect(REFERENCE.category).toBe('reference');
    expect(examList.some((exam) => exam.category === 'reference')).toBe(false);
  });

  it('knows which test types each exam has', () => {
    expect(hasTestType(getExam('neet')!, 'dpp')).toBe(true);
    expect(hasTestType(getExam('cbse')!, 'dpp')).toBe(false);
  });
});

describe('navigation', () => {
  it('matches the previous board sidebar, with locks', () => {
    const items = navigationFor(getExam('cbse')!);
    expect(items.map((i) => i.label)).toEqual([
      'Dashboard',
      'Learn',
      'Assessments',
      'Notes',
      'Study Plan',
      'Refer & Earn',
    ]);
    expect(items.map((i) => i.href('cbse'))).toEqual([
      '/cbse/dashboard',
      '/cbse/learn',
      '/cbse/assessments',
      '/cbse/notes',
      '/cbse/study-plan',
      '/cbse/refer-and-earn',
    ]);
    expect(items.filter((i) => i.lock === 'plan').map((i) => i.key)).toEqual(['learn', 'assessments', 'notes']);
    expect(items.find((i) => i.key === 'study-plan')?.lock).toBe('study-plan');
    expect(items.filter((i) => i.mobile).map((i) => i.key)).toEqual(['dashboard', 'learn', 'assessments', 'notes']);
  });

  it('matches the previous NEET sidebar; Daily Practice opens the live paper', () => {
    const items = navigationFor(getExam('neet')!);
    expect(items.map((i) => [i.label, i.href('neet')])).toEqual([
      ['Dashboard', '/neet/dashboard'],
      ['Notes', '/neet/notes'],
      ['Mock Tests', '/neet/mock-tests'],
      ['PYQ Library', '/neet/pyq-library'],
      ['Daily Practice', '/neet/daily-practice'],
      ['Refer & Earn', '/neet/refer-and-earn'],
      ['Custom Exam', '/neet/custom-test'],
    ]);
    expect(items.find((i) => i.key === 'daily-practice')?.opens).toBe('live-dpp');
    expect(items.some((i) => i.lock)).toBe(false);
  });

  it('reference navigation points at the reference books page', () => {
    expect(NAVIGATION.reference.map((i) => i.href(''))).toEqual(['/reference-books']);
  });

  it('locks items by plan and study plan', () => {
    const none = { hasPlan: false, hasStudyPlan: false };
    expect(isNavLocked({ lock: 'plan' }, none)).toBe(true);
    expect(isNavLocked({ lock: 'plan' }, { ...none, hasPlan: true })).toBe(false);
    expect(isNavLocked({ lock: 'study-plan' }, { hasPlan: true, hasStudyPlan: false })).toBe(true);
    expect(isNavLocked({ lock: 'study-plan' }, { hasPlan: true, hasStudyPlan: true })).toBe(false);
    expect(isNavLocked({}, none)).toBe(false);
  });

  it('marks the current section active, including pages below it', () => {
    expect(isActivePath('/cbse/learn', '/cbse/learn')).toBe(true);
    expect(isActivePath('/cbse/learn', '/cbse/learn/12')).toBe(true);
    expect(isActivePath('/cbse/learn', '/cbse/learning')).toBe(false);
  });

  it.each(examList)('$label: every sidebar link resolves to a page (no 404s)', (exam) => {
    const known = new Set(['dashboard', 'tests', ...Object.keys(SECTIONS[exam.category])]);
    const hrefs = navigationFor(exam).map((i) => i.href(exam.slug));
    for (const href of hrefs) {
      const [, slug, section] = href.split('/');
      expect(slug).toBe(exam.slug);
      expect(known).toContain(section);
    }
    for (const section of Object.keys(SECTIONS[exam.category])) expect(isSectionKey(section)).toBe(true);
  });

  it('titles sections per category', () => {
    expect(sectionTitle(getExam('cbse')!, 'study-plan')).toBe('Study Plan');
    expect(sectionTitle(getExam('neet')!, 'study-plan')).toBeNull();
    expect(sectionTitle(getExam('neet')!, 'plans')).toBe('My Plans');
  });
});

describe('routes', () => {
  it('keeps the previous app URLs for sections', () => {
    expect(routes.studyPlan('cbse')).toBe('/cbse/study-plan');
    expect(routes.customTest('neet')).toBe('/neet/custom-test');
    expect(routes.referenceBooks()).toBe('/reference-books');
    expect(SECTION_KEYS).toContain('doubt-solver');
    expect(isSectionKey('dashboard')).toBe(false);
  });

  it('builds exam URLs', () => {
    expect(routes.testResult('neet', 'mock', 42)).toBe('/neet/tests/mock/result/42');
    expect(routes.verifyOtp('signup')).toBe('/verify-otp?flow=signup');
  });

  it('lists the pages that need no session', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/setup')).toBe(true);
    expect(isPublicPath('/cbse/dashboard')).toBe(false);
    expect(isPublicPath('/login-old')).toBe(false);
  });
});
