'use client';

import { cx } from '@prepzy/design-system';
import { Check } from 'lucide-react';
import { toSentenceCase, type SyllabusModule } from '../api';

// Competitive (NEET) chapter picker pieces: the previous NEET app's "Choose topics for your study plan" desktop
// grid (Figma 28:30346) — two-column topic cards, no chapter numbers and no topic counts. Phones keep the shared rows.

/** One desktop topic card ("Topic Card" / "Topic Card Selected"). */
function TopicCard({ name, selected, onToggle }: { name: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cx(
        'flex min-w-0 items-center gap-4 rounded-2xl border-solid p-6 text-left transition-colors',
        selected
          ? 'border-brand bg-brand-50 border-[2px] shadow-[0px_10px_12px_rgba(61,52,139,0.07)]'
          : 'border-brand-175 bg-surface border-[1px] shadow-[0px_8px_10px_rgba(61,52,139,0.03)] hover:bg-neutral-50',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'flex size-6 shrink-0 items-center justify-center rounded-[6px]',
          selected ? 'bg-brand' : 'bg-surface border-[1.5px] border-solid border-neutral-900/30',
        )}
      >
        {selected && <Check className="text-on-brand size-[14px]" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 text-[16px] leading-6 font-bold text-neutral-900">{toSentenceCase(name)}</span>
    </button>
  );
}

/** The subject's chapters as a two-column grid of topic cards (desktop only). */
export function CompetitiveTopicGrid({
  modules,
  selected,
  onToggle,
}: {
  modules: SyllabusModule[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="hidden grid-cols-2 gap-4 md:grid">
      {modules.map((m) => (
        <TopicCard key={m.id} name={m.name} selected={selected.has(m.id)} onToggle={() => onToggle(m.id)} />
      ))}
      {modules.length === 0 && (
        <p className="text-[13px] leading-[18px] font-medium text-neutral-900/60">
          No chapters are available for this subject yet.
        </p>
      )}
    </div>
  );
}
