import { cx } from '@prepzy/design-system';
import type { CSSProperties } from 'react';
import { competitiveSubjectArt } from './subject-art';

const mask = (src: string): CSSProperties => ({
  maskImage: `url(${src})`,
  WebkitMaskImage: `url(${src})`,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
});

/**
 * A competitive subject's background illustration, pinned to its card's bottom corner (the card must be `relative`,
 * `overflow-hidden` and a `group`). As in the previous app: brand-coloured shapes at rest; with `hover`, hovering
 * (or keyboard-focusing) the card outlines them in orange. The artwork files are masks, so both colours are tokens.
 */
export function CompetitiveSubjectArt({
  subject,
  hover = false,
  className,
}: {
  subject: string;
  hover?: boolean;
  className?: string;
}) {
  const art = competitiveSubjectArt(subject);
  return (
    <span
      aria-hidden="true"
      data-testid="subject-art"
      data-art={art.src}
      className={cx('pointer-events-none absolute', className)}
      style={{ bottom: art.bottom, right: art.right, left: art.left, width: art.width, height: art.height }}
    >
      <span className="bg-brand absolute inset-0" style={mask(art.src)} />
      {hover && (
        <span
          className="bg-accent-400 absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={mask(art.hoverSrc)}
        />
      )}
    </span>
  );
}
