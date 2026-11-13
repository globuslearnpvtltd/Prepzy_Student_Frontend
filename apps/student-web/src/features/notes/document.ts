import DOMPurify from 'dompurify';
import type { NoteTopic } from './api';

/** One entry of a chapter's index: the element to scroll to and the title to show. */
export interface NoteSection {
  id: string;
  title: string;
}

export interface NotesDocument {
  /** Sanitised notes HTML with an id on every indexed section and tables wrapped to scroll sideways. */
  html: string;
  sections: NoteSection[];
}

/** Compares titles ignoring case, punctuation, quotes and leading numbering ("2.1 Electric Field"). */
const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/^\s*(\d+(\.\d+)*|[ivxlc]+)[.)]?\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

/**
 * Prepares a chapter's notes for reading and builds its index.
 *
 * The index comes from `notes_index_ref` (`[{ anchor_id, topic }]`): an entry points at the element with that id. When
 * the id isn't in the HTML, the heading with the same title is used (and given an id). When none of the entries can be
 * found, or the chapter has no index, the notes' own section headings (h2, else h1, else h3) make the index. Entries
 * that point nowhere are left out, so every index entry scrolls somewhere.
 */
export function prepareNotes(html: string, topics: readonly NoteTopic[]): NotesDocument {
  if (!html || typeof window === 'undefined') return { html: '', sections: [] };
  // Whole documents (<html><head><style>…) come back as their body; scripts, styles and event handlers are dropped.
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const body = new DOMParser().parseFromString(`<!doctype html><body>${clean}</body>`, 'text/html').body;

  const taken = new Set(Array.from(body.querySelectorAll('[id]'), (element) => element.id));
  const giveId = (element: Element, wanted: string) => {
    if (element.id) return element.id;
    let id = `notes-${slug(wanted)}`;
    for (let n = 2; taken.has(id); n += 1) id = `notes-${slug(wanted)}-${n}`;
    taken.add(id);
    element.id = id;
    return id;
  };

  const headings = Array.from(body.querySelectorAll('h1, h2, h3, h4'));
  const byTitle = (title: string) => {
    const wanted = normalise(title);
    if (!wanted) return undefined;
    return (
      headings.find((h) => normalise(h.textContent ?? '') === wanted) ??
      headings.find((h) => {
        const text = normalise(h.textContent ?? '');
        return !!text && (text.startsWith(wanted) || wanted.startsWith(text));
      })
    );
  };

  const sections: NoteSection[] = [];
  const add = (element: Element, title: string, wanted: string) => {
    const id = giveId(element, wanted);
    if (!sections.some((s) => s.id === id)) sections.push({ id, title });
  };

  for (const topic of topics) {
    const element = Array.from(body.querySelectorAll('[id]')).find((e) => e.id === topic.anchorId) ?? byTitle(topic.topic);
    if (element) add(element, topic.topic, topic.anchorId);
  }

  if (sections.length === 0) {
    // The level that splits the chapter into sections: prefer one with several headings.
    const levels = ['h2', 'h1', 'h3'];
    const count = (tag: string) => body.querySelectorAll(tag).length;
    const level = levels.find((tag) => count(tag) > 1) ?? levels.find((tag) => count(tag) > 0);
    if (level) {
      for (const heading of Array.from(body.querySelectorAll(level))) {
        const title = (heading.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (title) add(heading, title, title);
      }
    }
  }

  // Wide tables scroll inside their own box instead of widening the page.
  for (const table of Array.from(body.querySelectorAll('table'))) {
    if (table.parentElement?.classList.contains('table-scroll')) continue;
    const wrapper = body.ownerDocument.createElement('div');
    wrapper.className = 'table-scroll';
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  }

  return { html: body.innerHTML, sections };
}
