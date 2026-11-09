import { cx } from '@prepzy/design-system';

/** Bouncing voice bars + pulse ring (Vedica's "Talk live" buttons). */
export function LiveWaveIcon({ live = false }: { live?: boolean }) {
  return (
    <span className="relative flex size-[22px] flex-none items-center justify-center">
      <span aria-hidden className="live-talk-ring bg-surface/60 absolute inset-0 rounded-full" />
      <span aria-hidden className="bg-surface/20 relative flex size-full items-center justify-center gap-[2px] rounded-full">
        {[0, 0.2, 0.4, 0.1, 0.3].map((delay, i) => (
          <span key={i} className="live-talk-bar bg-surface w-[2px] rounded-full" style={{ height: i === 2 ? 12 : i % 2 ? 9 : 6, animationDelay: `${delay}s` }} />
        ))}
      </span>
      {live && <span aria-hidden className={cx('bg-voice-ok-light ring-voice-indigo absolute -top-[2px] -right-[2px] size-[8px] animate-pulse rounded-full ring-2')} />}
    </span>
  );
}
