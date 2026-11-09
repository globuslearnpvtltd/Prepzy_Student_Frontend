import { legacyLearnRedirects, resolveLegacyLearnPath } from './legacy-learn-redirects';

describe('legacy learn / notes redirects', () => {
  it.each([
    ['/cbse/learns/course/5', '/cbse/learn/5'],
    ['/cbse/learns/course/5/module/2', '/cbse/learn/5/2'],
    ['/cbse/learns/course/5/module/2/lecture/9', '/cbse/learn/5/2/lecture/9'],
    ['/cbse/learns/course/5/module/2/pyqs', '/cbse/learn/5/2/pyqs'],
    ['/cbse/learns/course/5/module/2/ncert-questions', '/cbse/learn/5/2/ncert-questions'],
    ['/cbse/learns/course/5/assessments/final_exam/31', '/cbse/tests/final/31'],
    ['/cbse/learns/course/5/assessments/mid_term_exam/32', '/cbse/tests/mid/32'],
    ['/cbse/learns/course/5/assessments/unit_test/33', '/cbse/tests/quiz/33'],
    ['/cbse/assessments/5', '/cbse/learn/5'],
    ['/neet/learn/course/1', '/neet/learn/1'],
    ['/neet/learn/course/1/module/2', '/neet/learn/1/2'],
    ['/neet/learn/course/1/module/2/chapterPyq', '/neet/learn/1/2/chapter-pyq'],
    ['/neet/learn/course/1/module/2/video-lectures', '/neet/learn/1/2/video-lectures'],
    ['/neet/analytics', '/neet/dashboard'],
    ['/cbse/notes-view/5', '/cbse/notes/5'],
    ['/cbse/summary-video/4', '/cbse/notes/video/4'],
    ['/cbse/course-detail/5', '/cbse/courses/5'],
    ['/cbse/personal-info', '/cbse/profile'],
    ['/cbse/exam/7', '/cbse/assessments'],
  ])('%s → %s', (from, to) => {
    expect(resolveLegacyLearnPath(from)).toBe(to);
  });

  it('leaves current pages and unknown exams alone', () => {
    expect(resolveLegacyLearnPath('/cbse/assessments')).toBeNull();
    expect(resolveLegacyLearnPath('/cbse/learn/5')).toBeNull();
    expect(resolveLegacyLearnPath('/jee/learns/course/5')).toBeNull();
    // Competitive-only rules don't apply to board exams.
    expect(resolveLegacyLearnPath('/cbse/analytics')).toBeNull();
  });

  it('declares permanent redirects only', () => {
    expect(legacyLearnRedirects.every((r) => r.permanent)).toBe(true);
  });
});
