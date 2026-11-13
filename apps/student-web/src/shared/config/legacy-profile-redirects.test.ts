import { DEFAULT_EXAM, examList } from './exams';
import { legacyProfileRedirects, resolveLegacyProfilePath } from './legacy-profile-redirects';

describe('legacy profile redirects', () => {
  const other = examList.find((exam) => exam.slug !== DEFAULT_EXAM)!;

  it.each([
    ['/profile', '/profile'],
    ['/profile/parent', '/profile/parent'],
    ['/profile/help', '/profile/help'],
    ['/change-password', '/profile/change-password'],
    ['/request-account-delete', '/profile/request-account-delete'],
  ])('%s → the remembered exam, else the default exam', (from, page) => {
    expect(resolveLegacyProfilePath(from, { prepzy_exam: other.slug })).toBe(`/${other.slug}${page}`);
    expect(resolveLegacyProfilePath(from)).toBe(`/${DEFAULT_EXAM}${page}`);
    expect(resolveLegacyProfilePath(from, { prepzy_exam: 'unknown' })).toBe(`/${DEFAULT_EXAM}${page}`);
  });

  it('leaves other paths alone and only uses temporary redirects', () => {
    expect(resolveLegacyProfilePath('/profile/other')).toBeNull();
    expect(legacyProfileRedirects.every((rule) => !rule.permanent)).toBe(true);
  });
});
