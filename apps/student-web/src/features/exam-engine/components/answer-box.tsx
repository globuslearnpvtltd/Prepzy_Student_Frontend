'use client';

import { Skeleton } from '@prepzy/design-system';
import dynamic from 'next/dynamic';
import type { RichAnswerBoxProps } from './rich-answer-box';

/**
 * Written answer box. The TipTap editor (./rich-answer-box) is loaded on demand, so only the test player
 * downloads it; pages that never show a written question don't pay for it.
 */
export const AnswerBox = dynamic<RichAnswerBoxProps>(
  () => import('./rich-answer-box'),
  {
    ssr: false,
    loading: () => <Skeleton aria-label="Loading answer box" className="min-h-[220px] w-full rounded-[14px]" />,
  },
);
