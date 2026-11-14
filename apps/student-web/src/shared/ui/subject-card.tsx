'use client';

import { cx } from '@prepzy/design-system';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { boardSubjectArt } from './subject-art';

/**
 * The board subject card of the dashboard's "My Subjects": name, a count line and the subject illustration; on hover
 * it fills with the brand colour, grows slightly and the text and illustration turn white. Every board subject grid
 * (dashboard / Learn, Assessments, the syllabus picker) uses this card, so they look and hover the same.
 * A card is a link (`href`) or a button (`onClick`).
 */
export interface SubjectCardItem {
  key: string;
  /** Shown as given (callers title-case it). */
  title: string;
  /** Second line, e.g. "3 Books" or "4 Exams". */
  meta?: string;
  /** The subject name the illustration is picked by (defaults to the title). */
  subject?: string;
  href?: string;
  onClick?: () => void;
}

const cardClass =
  'group border-line hover:bg-brand relative flex min-h-[96px] w-full flex-col overflow-hidden rounded-xl border-2 px-6 py-4 text-left transition-all duration-300 hover:scale-105';

export function SubjectCard({ title, meta, subject, href, onClick }: Omit<SubjectCardItem, 'key'>) {
  const art = boardSubjectArt(subject ?? title);
  const body = (
    <>
      <span className="text-foreground group-hover:text-on-brand relative z-10 line-clamp-2 text-[22px] leading-7 font-semibold">{title}</span>
      {meta && <span className="text-foreground group-hover:text-on-brand relative z-10 mt-2 text-[14px] font-bold">{meta}</span>}
      <Image
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        unoptimized
        className="absolute group-hover:brightness-0 group-hover:invert"
        style={{ bottom: art.bottom, right: art.right, left: art.left }}
      />
    </>
  );
  return href ? (
    <Link href={href} className={cardClass}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cardClass}>
      {body}
    </button>
  );
}

/**
 * A grid of subject cards: one column on phones, `columns` from md up. With `collapse`, phones show the first three
 * and a "View All Subjects" toggle (as the dashboard's My Subjects).
 */
export function SubjectCardGrid({
  items,
  columns = 3,
  collapse = false,
  className,
  label,
}: {
  items: readonly SubjectCardItem[];
  columns?: 2 | 3;
  collapse?: boolean;
  className?: string;
  label?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <>
      <ul
        aria-label={label}
        className={cx('grid grid-cols-1 gap-3 md:gap-5', columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3', className)}
      >
        {items.map(({ key, ...card }, index) => (
          <li key={key} className={cx(collapse && index >= 3 && !showAll && 'max-md:hidden')}>
            <SubjectCard {...card} />
          </li>
        ))}
      </ul>
      {collapse && items.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="border-line text-foreground mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 py-1 font-medium md:hidden"
        >
          {showAll ? 'Show Less' : 'View All Subjects'}
          <ChevronDown aria-hidden className={cx('size-5 transition-transform', showAll && 'rotate-180')} />
        </button>
      )}
    </>
  );
}
