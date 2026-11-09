import { legacyPlanRedirects, resolveLegacyPlanPath } from './legacy-plan-redirects';

describe('legacy plan redirects', () => {
  it.each([
    ['/view-plans', '/cbse/plans'],
    ['/neet/manage-plans', '/neet/plans'],
    ['/neet/purchase-plan', '/neet/plans/purchase'],
    ['/neet/billing-history', '/neet/plans/billing'],
    ['/pre-dashboard', '/welcome'],
    ['/invoice/12', '/cbse/plans'],
  ])('%s → %s', (from, to) => {
    expect(resolveLegacyPlanPath(from)).toBe(to);
  });

  it('sends /purchase to the exam from ?exam=, then the remembered exam, then the default', () => {
    expect(resolveLegacyPlanPath('/purchase', { exam: 'neet-ug' }, { prepzy_exam: 'cbse' })).toBe('/neet/plans/purchase');
    expect(resolveLegacyPlanPath('/purchase', {}, { prepzy_exam: 'neet' })).toBe('/neet/plans/purchase');
    expect(resolveLegacyPlanPath('/purchase-plan')).toBe('/cbse/plans/purchase');
  });

  it('only uses temporary redirects for the exam-dependent checkout', () => {
    expect(legacyPlanRedirects.filter((r) => r.source.startsWith('/purchase')).every((r) => !r.permanent)).toBe(true);
  });
});
