'use client';

import { useMemo } from 'react';
import { RichText } from '@/features/exam-engine/ui';
import { NOTES_SCOPE, prepareNotes, type NotesDocument } from '../document';
import styles from './notes-html.module.css';

/**
 * A chapter's notes. A document that brings its own stylesheet (the notes_json header, or the previous app's header
 * around notes_text) is shown with it, scoped to this box so it can't restyle the app; one without falls back to
 * `fallbackClassName` (the reader's token-based notes styles).
 */
export function NotesContent({ doc, fallbackClassName = styles.notes }: { doc: NotesDocument; fallbackClassName?: string }) {
  const ownStyles = !!doc.css;
  return (
    <div {...{ [NOTES_SCOPE]: '' }} className="min-w-0">
      {doc.fonts.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="notes-fonts" />
      ))}
      {ownStyles && <style>{doc.css}</style>}
      <RichText html={doc.html} className={ownStyles ? styles.document : fallbackClassName} />
    </div>
  );
}

/** NotesContent for notes HTML that has no index (the competitive chapter's study notes). */
export function NotesHtml({ html, fallbackClassName }: { html: string; fallbackClassName?: string }) {
  const doc = useMemo(() => prepareNotes(html, []), [html]);
  return <NotesContent doc={doc} fallbackClassName={fallbackClassName} />;
}
