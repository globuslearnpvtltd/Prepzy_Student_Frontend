'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useClassContext, usePlanStatus } from '@/features/study-plan';
import { Notice, ScreenLoader } from '@/features/study-plan/ui';
import { routes } from '@/shared/config/routes';
import { diagnosticApi, type DiagnosticResult, type SubjectStrength } from '../api';

const STEPS = [
  { key: 'overview', label: 'Overview', sub: 'Your preparation at a glance' },
  { key: 'subjects', label: 'Subjects', sub: 'How you performed' },
  { key: 'how', label: 'How You Learn', sub: 'Your learning & test style' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

const SCALES = {
  band: [
    { key: 'below_basic', label: 'Below Basic', meaning: 'The basics in these chapters are still being built. Starting from the concept rather than the practice is what will move this fastest.' },
    { key: 'basic', label: 'Basic', meaning: 'You have the core ideas, but they are not yet steady enough to rely on under time pressure. Regular practice on the same chapters will firm them up.' },
    { key: 'proficient', label: 'Proficient', meaning: 'You handle most of this comfortably. The gains now come from the specific gaps rather than from covering everything again.' },
    { key: 'advanced', label: 'Advanced', meaning: 'You are on top of these chapters. Harder questions and full-length timed sets are the useful next step.' },
  ],
  pace: [
    { key: 'rushing', label: 'Rushing', meaning: 'You finished well ahead of the time the paper allows. That spare time is worth spending on a second read of the questions you were unsure about.' },
    { key: 'normal', label: 'Normal', meaning: 'You used your time well — neither rushing nor running short. Keep that rhythm in the real paper.' },
    { key: 'careful', label: 'Careful', meaning: 'You spent longer on each question than the paper allows. Timed practice will help you reach the end without leaving questions behind.' },
  ],
  thinking: [
    { key: 'conceptual', label: 'Conceptual', meaning: 'You did best on questions that test whether you understand the idea, rather than ones that ask you to compute. Your plan leads with the explanation before the drill.' },
    { key: 'numerical', label: 'Numerical', meaning: 'You did best where there was a clear method to follow step by step. Your plan leans on worked examples so the method is visible before you practise it.' },
    { key: 'case_based', label: 'Case Based', meaning: 'You did best when an idea was set in a real situation and you had to work out what applied. Your plan uses applied questions to build on that.' },
    { key: 'balanced', label: 'No clear style', meaning: 'No single question type stood out — your accuracy was close across them. That is a fine place to be; your plan keeps a balance rather than favouring one kind.' },
  ],
};

const PACE_COPY: Record<string, string> = {
  rushing: 'You moved quickly through the paper. A short review after each test will catch the slips.',
  normal: 'Your pace was steady — enough time on each question without running the clock down.',
  careful: 'You took your time on each question. Timed practice will help you finish the paper comfortably.',
};

export const thinkingReasonCopy = (reason: string | null) =>
  reason === 'clear_lead'
    ? 'You performed clearly better on one kind of question.'
    : reason === 'insufficient_coverage'
      ? "This test didn't cover enough of each question types for us to call a style yet."
      : 'You performed evenly across question types.';

/** Strongest and weakest subject; a lone subject at 0% counts as "needs time". */
export function pickExtremes(subjects: SubjectStrength[]) {
  const ranked = [...subjects].sort((a, b) => b.pct - a.pct);
  if (ranked.length === 1) return ranked[0]!.pct === 0 ? { strongest: null, weakest: ranked[0]! } : { strongest: ranked[0]!, weakest: null };
  return { strongest: ranked[0] ?? null, weakest: ranked.length > 1 ? ranked[ranked.length - 1]! : null };
}

/** Summary lines and insight cards (AI summary when present, else derived from the scores). */
export function overview(result: DiagnosticResult) {
  const { strongest, weakest } = pickExtremes(result.subjects);
  const ai = result.aiSummary;
  const fallback = [
    strongest ? `${strongest.name} is clearly your strength, so it needs the least practice time right now.` : null,
    weakest ? `${weakest.name} needs the most attention, so it gets the largest share of your week.` : null,
    result.thinking.label ? thinkingReasonCopy(result.thinking.reason) : null,
    PACE_COPY[result.pace.band] ?? null,
  ].filter((line): line is string => !!line);
  const needsTime = (s: SubjectStrength) => ({ label: 'Needs time', title: s.name, body: `At ${Math.round(s.pct)}%, this is the toughest for you right now, so it gets the largest share of your plan.` });
  const cards: { label: string; title: string; body: string }[] = [];
  if (ai) {
    const zeroOnly = !strongest && !!weakest;
    if (ai.strongest && !zeroOnly) cards.push({ label: 'Strongest subject', title: ai.strongest.name, body: ai.strongest.summary });
    if (ai.needsTime) cards.push({ label: 'Needs time', title: ai.needsTime.name, body: ai.needsTime.summary });
    else if (zeroOnly && weakest) cards.push(needsTime(weakest));
    if (ai.howYouLearn) cards.push({ label: 'How you learn', title: ai.howYouLearn.tagline, body: ai.howYouLearn.suggestion });
  } else {
    if (strongest) cards.push({ label: 'Strongest subject', title: strongest.name, body: `You scored ${Math.round(strongest.pct)}% here. This subject needs the least practice time right now.` });
    if (weakest) cards.push(needsTime(weakest));
    if (result.thinking.label) cards.push({ label: 'How you learn', title: result.thinking.label, body: thinkingReasonCopy(result.thinking.reason) });
  }
  return { lines: ai?.summary.length ? ai.summary : fallback, cards, strongest, weakest };
}

const panel = 'border-neutral-150 bg-surface rounded-2xl border shadow-[0px_12px_28px_rgba(15,23,42,0.04)]';

function ProfileCard({ className }: { className?: string }) {
  return (
    <div className={cx('flex flex-col gap-[6px] rounded-xl bg-[linear-gradient(135deg,var(--color-night-900),var(--color-brand-700))] p-5 md:gap-1', className)}>
      <span className="text-brand-300 text-[11px] font-semibold tracking-[0.44px] uppercase">Diagnostic Journey</span>
      <span className="text-on-brand text-[24px] leading-[30px] font-bold">Your Learning Profile</span>
      <span className="text-on-brand/70 text-[14px] font-medium">Atlas has mapped your strengths, gaps, and learning patterns.</span>
    </div>
  );
}

function WhyThisMatters({ className }: { className?: string }) {
  return (
    <div className={cx('border-accent-100 bg-accent-50 flex flex-col gap-1 rounded-xl border px-5 py-4', className)}>
      <span className="text-accent-400 text-[16px] font-bold">Why this matters</span>
      <span className="text-[13px] leading-5 text-neutral-600">
        Your results shape your plan. Atlas uses these insights to decide where you need more practice, revision and study time.
      </span>
    </div>
  );
}

function Scale({ title, subtitle, options, active, measure }: { title: string; subtitle: string; options: { key: string; label: string; meaning: string }[]; active: string; measure?: string }) {
  const current = options.find((o) => o.key === active) ?? options[0]!;
  return (
    <div className={cx(panel, 'flex flex-col gap-4 p-5')}>
      <div>
        <p className="text-[16px] font-bold text-neutral-900">{title}</p>
        <p className="text-[13px] text-neutral-500">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {options.map((o) => (
          <span
            key={o.key}
            aria-current={o.key === current.key}
            className={cx('flex-1 rounded-md px-2 py-2 text-center text-[12px] font-semibold', o.key === current.key ? 'bg-brand text-on-brand' : 'bg-brand-50 text-neutral-500')}
          >
            {o.label}
          </span>
        ))}
      </div>
      {measure && <p className="text-brand text-[13px] font-semibold">{measure}</p>}
      <p className="text-[14px] leading-[1.55] text-neutral-700">{current.meaning}</p>
    </div>
  );
}

const minutes = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} sec` : `${m} min`;
};

/** "Here is what I found": the diagnostic report, and the way into the study plan. */
export function DiagnosticResultScreen() {
  const search = useSearchParams();
  const assessmentId = search.get('assessment_id');
  const { exam, classId, isPending } = useClassContext();
  const result = useQuery({ queryKey: ['diagnostic', 'result', classId, assessmentId], queryFn: () => diagnosticApi.result(classId!, assessmentId), enabled: !!classId, retry: false });
  const status = usePlanStatus(classId);
  const [step, setStep] = useState<StepKey>('overview');
  const slug = exam?.slug ?? '';

  if (!isPending && !classId) return <Notice title="No active class" body="Pick a class from the sidebar to see your diagnostic report." />;
  if (isPending || result.isPending) return <ScreenLoader message="Loading Your Report" sub="Pulling together your diagnostic results..." />;
  if (result.isError)
    return <Notice title="No diagnostic report yet" body="Take the diagnostic test to see your personalised report." action={{ label: 'Take the diagnostic test', href: routes.diagnostic(slug) }} />;

  const data = result.data;
  const built = status.data ? !status.data.canCreate && status.data.hasPlan : false;
  const cta = built
    ? { title: 'Your plan is ready', body: 'This report has already been turned into a study plan.', label: 'View My Study Plan', href: routes.studyPlan(slug) }
    : { title: 'Ready for your plan?', body: 'Atlas will turn these insights into a focused weekly schedule.', label: 'Build My Study Plan', href: routes.studyPlanChapters(slug) };
  const { lines, cards, strongest, weakest } = overview(data);
  const expired = data.status === 'expired' && (
    <div className="bg-accent-50 border-accent-100 rounded-xl border p-4">
      <p className="text-accent-800 text-sm font-semibold">This test was auto-submitted when the timer ran out</p>
      <p className="text-accent-700 text-xs">Only the questions you answered before time expired were scored.</p>
    </div>
  );
  const thinkingKey = SCALES.thinking.some((o) => o.key === data.thinking.leaning) ? data.thinking.leaning! : 'balanced';

  return (
    <div className="flex w-full flex-col gap-4">
      {expired}
      <div className="flex flex-col gap-5 md:gap-6 md:rounded-[28px] md:bg-neutral-50 md:p-8 lg:flex-row lg:items-stretch">
        <aside className={cx(panel, 'hidden w-full shrink-0 flex-col gap-5 self-start p-6 md:flex lg:w-[331px]')}>
          <ProfileCard />
          <nav aria-label="Report sections" className="flex flex-col gap-2">
            {STEPS.map((item, index) => {
              const active = step === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active}
                  onClick={() => setStep(item.key)}
                  className={cx('flex items-center gap-[10px] rounded-lg border p-[18px] text-left', active ? 'border-brand-175 bg-brand-50' : 'border-neutral-150')}
                >
                  <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold', active ? 'bg-brand text-on-brand' : 'bg-brand-50 text-brand')}>{index + 1}</span>
                  <span className="flex flex-col">
                    <span className={cx('text-[14px] whitespace-nowrap', active ? 'text-brand font-semibold' : 'font-bold text-neutral-800')}>{item.label}</span>
                    {active && <span className="text-[11px] font-medium tracking-[0.61px] whitespace-nowrap text-neutral-400 uppercase">{item.sub}</span>}
                  </span>
                </button>
              );
            })}
          </nav>
          <WhyThisMatters />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <ProfileCard className="md:hidden" />
          <div className="flex flex-col">
            <h1 className="text-[32px] leading-[42px] font-bold text-neutral-900 md:leading-[48px]">Here is what I found</h1>
            <p className="text-[16px] leading-6 text-neutral-500">
              Based on {data.totalQuestions} questions across {data.subjects.length} subjects
            </p>
          </div>
          <div role="tablist" aria-label="Report sections" className="flex w-full overflow-x-auto md:hidden">
            {STEPS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={step === item.key}
                onClick={() => setStep(item.key)}
                className={cx('shrink-0 rounded-full border px-3 py-2 text-[14px] whitespace-nowrap', step === item.key ? 'border-neutral-150 bg-brand-50 text-brand font-bold' : 'border-transparent font-semibold text-neutral-700')}
              >
                {item.label}
              </button>
            ))}
          </div>
          {step === 'overview' && (
            <div className="border-brand-175 bg-brand-50 flex flex-col gap-4 rounded-2xl border p-6">
              <div className="flex gap-4">
                <span className="bg-brand text-on-brand flex size-10 shrink-0 items-center justify-center rounded-full font-bold">A</span>
                <div className="flex flex-col gap-1">
                  <span className="text-[18px] font-bold text-neutral-900">Atlas AI</span>
                  <ul className="flex flex-col gap-2 text-[16px] leading-[1.5] text-neutral-700">
                  {lines.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden className="bg-brand mt-2 size-[6px] shrink-0 rounded-full" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                  </ul>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {cards.map((card) => (
                  <div key={card.label} className={cx(panel, 'flex flex-col gap-2 p-5')}>
                    <span className="text-brand text-[11px] font-semibold tracking-[0.5px] uppercase">{card.label}</span>
                    <span className="text-[18px] font-bold text-neutral-900">{card.title}</span>
                    <span className="text-[13px] leading-5 text-neutral-600">{card.body}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 'subjects' && (
            <div className={cx(panel, 'flex flex-col gap-4 p-5')}>
              {[...data.subjects]
                .sort((a, b) => b.pct - a.pct)
                .map((subject) => {
                  const tag = subject === strongest ? 'strong' : subject === weakest ? 'focus' : null;
                  return (
                    <div key={subject.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
                          {subject.name}
                          {tag && (
                            <span className={cx('rounded-full px-2 py-[2px] text-[11px] font-semibold', tag === 'strong' ? 'bg-success-50 text-success-700' : 'bg-accent-50 text-accent-800')}>
                              {tag === 'strong' ? 'Strongest' : 'Needs focus'}
                            </span>
                          )}
                        </span>
                        <span className="text-brand text-[14px] font-bold">{Math.round(subject.pct)}%</span>
                      </div>
                      <div className="bg-brand-175 h-2 overflow-hidden rounded-full">
                        <div className="bg-brand h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, subject.pct))}%` }} />
                      </div>
                      <span className="text-[12px] text-neutral-500">
                        {subject.correct} of {subject.questions} correct
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
          {step === 'how' && (
            <div className="flex flex-col gap-4">
              <Scale title="Where you stand" subtitle="Your overall level across the chapters you picked" options={SCALES.band} active={data.academicBand} measure={`${Math.round(data.overallPercent)}% overall`} />
              <Scale title="How you used the time" subtitle="Measured against the time this paper allows" options={SCALES.pace} active={data.pace.band} measure={`${minutes(data.pace.takenSeconds)} of ${minutes(data.pace.totalSeconds)}`} />
              <Scale title="The kind of question you answer best" subtitle="Based on where your accuracy was highest" options={SCALES.thinking} active={thinkingKey} />
            </div>
          )}
          <WhyThisMatters className="md:hidden" />
          <div className={cx(panel, 'sticky bottom-4 z-10 mt-auto flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between')}>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-bold text-neutral-900">{cta.title}</span>
              <span className="text-[13px] text-neutral-600">{cta.body}</span>
            </div>
            <Link href={cta.href} className="bg-brand border-brand text-on-brand flex h-[50px] shrink-0 items-center justify-center gap-2 rounded-md border px-6 text-[14px] font-bold hover:opacity-90">
              {cta.label}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
