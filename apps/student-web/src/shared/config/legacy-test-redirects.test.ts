import { legacyTestRedirects, resolveLegacyTestPath } from './legacy-test-redirects';

describe('legacy test redirects', () => {
  it.each([
    ['/cbse/mock-exam/8', '/cbse/tests/mock/8'],
    ['/cbse/mock-result/300', '/cbse/tests/mock/result/300'],
    ['/neet/mock-exam/4', '/neet/tests/mock/4'],
    ['/neet/mock-exam-result/1', '/neet/tests/mock/result/1'],
    ['/neet/pyq-exam-result/2', '/neet/tests/pyq/result/2'],
    ['/cbse/chapter-pyq/5', '/cbse/tests/chapter-pyq/5'],
    ['/neet/chapter-pyq-exam/14', '/neet/tests/chapter-pyq/14'],
    ['/neet/custom-exam-result/9', '/neet/tests/custom/result/9'],
    ['/cbse/final-exam-result/3', '/cbse/tests/final/result/3'],
    ['/cbse/quiz-exam/6', '/cbse/tests/quiz/6'],
    ['/neet/practice-exam/40', '/neet/tests/practice/40'],
    ['/cbse/dpp-exam/7', '/cbse/tests/dpp/7'],
    ['/neet/dpp/7', '/neet/tests/dpp/7'],
  ])('%s → %s', (from, to) => {
    expect(resolveLegacyTestPath(from)).toBe(to);
  });

  it('ignores unknown exams, sections and deeper paths', () => {
    expect(resolveLegacyTestPath('/jee/mock-exam/1')).toBeNull();
    expect(resolveLegacyTestPath('/cbse/dashboard/1')).toBeNull();
    expect(resolveLegacyTestPath('/cbse/mock-exam/1/extra')).toBeNull();
    expect(resolveLegacyTestPath('/cbse/mock-exam')).toBeNull();
  });

  it('gives Next permanent redirects restricted to registered exams', () => {
    expect(legacyTestRedirects).toContainEqual({
      source: '/:exam(cbse|neet)/mock-exam/:id',
      destination: '/:exam/tests/mock/:id',
      permanent: true,
    });
    expect(legacyTestRedirects).toContainEqual({
      source: '/:exam(cbse|neet)/practice-result/:id',
      destination: '/:exam/tests/practice/result/:id',
      permanent: true,
    });
  });
});
