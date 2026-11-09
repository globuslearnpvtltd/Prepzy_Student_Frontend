'use client';

import { cx } from '@prepzy/design-system';
import DOMPurify from 'dompurify';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

/** LaTeX delimiters used by the question bank: $…$, $$…$$, \(…\), \[…\]. */
const MATH_PATTERN = /\$[^$]+\$|\\\(|\\\[/;

const MATHJAX_CONFIG = {
  tex: {
    inlineMath: [
      ['$', '$'],
      ['\\(', '\\)'],
    ],
    displayMath: [
      ['$$', '$$'],
      ['\\[', '\\]'],
    ],
  },
  options: { enableMenu: false },
};

// MathJax (≈1 MB) is only downloaded when a question actually contains maths.
const MathHtml = dynamic(
  () =>
    import('better-react-mathjax').then(({ MathJax, MathJaxContext }) => {
      function MathHtmlImpl({ html, className }: { html: string; className?: string }) {
        return (
          <MathJaxContext config={MATHJAX_CONFIG}>
            <MathJax dynamic hideUntilTypeset="first">
              <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
            </MathJax>
          </MathJaxContext>
        );
      }
      return MathHtmlImpl;
    }),
  { ssr: false },
);

/** Renders question / answer HTML from the backend safely (sanitised), with maths when present. */
export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = useMemo(
    () => (html && typeof window !== 'undefined' ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : ''),
    [html],
  );
  if (!clean) return null;
  const classes = cx('rich-text', className);
  return MATH_PATTERN.test(clean) ? (
    <MathHtml html={clean} className={classes} />
  ) : (
    <div className={classes} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
