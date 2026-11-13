import { legacyPlanRedirects, resolveLegacyPlanPath } from './legacy-plan-redirects';

describe('legacy plan redirects', () => {
  it.each([
    ['/view-plans', '/manage-plans'],
    ['/view-subscription', '/manage-plans'],
    ['/neet/manage-plans', '/manage-plans'],
    ['/neet/purchase-plan', '/purchase?exam=neet'],
    ['/neet/billing-history', '/manage-plans'],
    ['/pre-dashboard', '/welcome'],
    ['/invoice/12', '/manage-plans'],
    ['/purchase-plan', '/purchase'],
  ])('%s → %s', (from, to) => {
    expect(resolveLegacyPlanPath(from)).toBe(to);
  });

  it('sends the exam-scoped checkout of any exam to the common /purchase, naming the exam', () => {
    expect(resolveLegacyPlanPath('/cbse/plans/purchase')).toBe('/purchase?exam=cbse');
    expect(resolveLegacyPlanPath('/neet/plans/purchase', { CLASSID: '20' })).toBe('/purchase?exam=neet');
    // An exam the code doesn't know: same rule, the page resolves it from GET /api/v4/exams.
    expect(resolveLegacyPlanPath('/icse/plans/purchase')).toBe('/purchase?exam=icse');
    // The old page let a link's own ?exam= win; Next passes it on unchanged.
    expect(resolveLegacyPlanPath('/cbse/plans/purchase', { exam: 'neet-ug' })).toBe('/purchase');
  });

  it('never redirects the common /purchase and /manage-plans pages themselves', () => {
    expect(resolveLegacyPlanPath('/purchase')).toBeNull();
    expect(resolveLegacyPlanPath('/purchase', { exam: 'neet' }, { prepzy_exam: 'cbse' })).toBeNull();
    expect(resolveLegacyPlanPath('/manage-plans')).toBeNull();
  });

  it('uses temporary redirects for every checkout URL that depends on the exam', () => {
    expect(legacyPlanRedirects.filter((r) => r.source.endsWith('/plans/purchase') || r.source === '/purchase-plan').every((r) => !r.permanent)).toBe(
      true,
    );
  });
});
