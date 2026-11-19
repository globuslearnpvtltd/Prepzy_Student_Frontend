import { availableTestTypes } from '@/features/exam-engine';
import {
  catalogExams,
  CATEGORY_DEFAULTS,
  examDesignFor,
  examFromCatalog,
  examList,
  examSlugOf,
  findExam,
  getExam,
  hasTestType,
  REFERENCE,
} from './exams';
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

describe('exams from the backend catalog (DB rows only)', () => {
  const CATALOG = [
    { examId: 1, name: 'CBSE', examSlice: 'cbse', category: 'board' as const },
    { examId: 2, name: 'NEET-UG', examSlice: 'neet-ug', category: 'competitive' as const },
    { examId: 8, name: 'ICSE', examSlice: 'icse', category: 'board' as const },
    { examId: 9, name: 'JEE Main', examSlice: 'jee-main', category: 'competitive' as const },
    { examId: 10, name: 'Reference Books', examSlice: 'reference', category: 'reference' as const },
    { examId: 11, name: 'Olympiad', examSlice: 'olympiad 2027', category: 'board' as const },
    // A registry slice listed under another category: not this app's exam.
    { examId: 12, name: 'JAC', examSlice: 'jac', category: 'competitive' as const },
    // A slice that is another exam's registry slug would shadow it.
    { examId: 13, name: 'Neet Crash', examSlice: 'neet', category: 'competitive' as const },
  ];

  it('keeps the registry polish and gives other exams their category defaults', () => {
    expect(examDesignFor(CATALOG[1]!)).toBe(getExam('neet'));
    expect(examDesignFor(CATALOG[2]!)).toEqual({ slug: 'icse', examSlice: 'icse', label: 'ICSE', category: 'board', ...CATEGORY_DEFAULTS.board });
    expect(examDesignFor(CATALOG[3]!)).toMatchObject({ slug: 'jee-main', label: 'JEE Main', theme: 'competitive', onboarding: { kind: 'choose-target-year' } });
    expect(CATALOG.slice(4).map(examDesignFor)).toEqual([null, null, null, null]);
    expect(availableTestTypes(examDesignFor(CATALOG[3]!)!)).toEqual(CATEGORY_DEFAULTS.competitive.testTypes);
  });

  it('lists and finds catalog exams by slug, slice, name or id', () => {
    expect(catalogExams(CATALOG).map((e) => `${e.slug}:${e.examId}`)).toEqual(['cbse:1', 'neet:2', 'icse:8', 'jee-main:9']);
    expect(examFromCatalog(CATALOG, 'neet')?.examId).toBe(2);
    expect(examFromCatalog(CATALOG, 'NEET-UG')?.slug).toBe('neet');
    expect(examFromCatalog(CATALOG, 'jee-main')?.examId).toBe(9);
    expect(examFromCatalog(CATALOG, 'JEE Main')?.slug).toBe('jee-main');
    expect(examFromCatalog(CATALOG, 8)?.slug).toBe('icse');
    expect(examFromCatalog(CATALOG, 'olympiad 2027')).toBeNull();
    expect(examFromCatalog(CATALOG, '')).toBeNull();
    expect(examFromCatalog(undefined, 'cbse')).toBeNull();
  });

  it('turns any exam value into a URL segment without the catalog', () => {
    expect(examSlugOf('neet-ug')).toBe('neet');
    expect(examSlugOf('JEE-Main')).toBe('jee-main');
    expect(examSlugOf('a b')).toBeNull();
    expect(examSlugOf(null)).toBeNull();
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

  it('builds the common checkout URL, with no exam in the path', () => {
    expect(routes.plansPurchase('cbse')).toBe('/purchase?exam=cbse');
    expect(routes.plansPurchase('neet', { CLASSID: 20, stream_id: 2 })).toBe('/purchase?exam=neet&CLASSID=20&stream_id=2');
    expect(routes.plansPurchase('icse-board')).toBe('/purchase?exam=icse-board');
    expect(routes.plansPurchase()).toBe('/purchase');
    expect(routes.plansPurchase(null, { CLASSID: 12 })).toBe('/purchase?CLASSID=12');
  });

  it('lists the pages that need no session', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/setup')).toBe(true);
    expect(isPublicPath('/cbse/dashboard')).toBe(false);
    expect(isPublicPath('/login-old')).toBe(false);
  });
});
