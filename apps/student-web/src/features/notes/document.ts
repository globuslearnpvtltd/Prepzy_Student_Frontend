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
  /** The document's own stylesheet (its <style> blocks), rewritten to apply only inside `[data-notes-doc]`. */
  css: string;
  /** Google Fonts stylesheets the document links to (the only outside stylesheets it may load). */
  fonts: string[];
}

/** The attribute on the element that holds the notes; the document's CSS applies only inside it. */
export const NOTES_SCOPE = 'data-notes-doc';
const SCOPE = `[${NOTES_SCOPE}]`;
const FONTS_ORIGIN = 'https://fonts.googleapis.com/';

/** Splits a selector list on its top-level commas (not those inside :is(), :not() …). */
const splitSelectors = (list: string) => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i += 1) {
    const char = list[i];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
};

/** `html`, `body` and `:root` at the start of a selector stand for the notes box; anything else is put inside it. */
const PAGE_SELECTOR = /^(?::root|html)?(?:\s*>?\s*body)?(?![\w-])/;
const scopeSelector = (selector: string) => {
  const page = selector.match(PAGE_SELECTOR)?.[0] ?? '';
  return page ? `${SCOPE}${selector.slice(page.length)}` : `${SCOPE} ${selector}`;
};

const scopeRules = (rules: CSSRuleList): string =>
  Array.from(rules, (rule) => {
    if (rule instanceof CSSStyleRule) {
      const selectors = splitSelectors(rule.selectorText);
      // The document's page background belongs to the page; the reader draws the notes on its own card.
      if (selectors.every((selector) => PAGE_SELECTOR.exec(selector)?.[0] === selector)) {
        for (const property of ['background', 'background-color', 'background-image']) rule.style.removeProperty(property);
      }
      return `${selectors.map(scopeSelector).join(', ')} { ${rule.style.cssText} }`;
    }
    if (rule instanceof CSSMediaRule) return `@media ${rule.media.mediaText} { ${scopeRules(rule.cssRules)} }`;
    if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText} { ${scopeRules(rule.cssRules)} }`;
    // @font-face and @keyframes don't select elements; other at-rules (@import, @page …) are dropped.
    if (rule instanceof CSSFontFaceRule || rule instanceof CSSKeyframesRule) return rule.cssText;
    return '';
  })
    .filter(Boolean)
    .join('\n');

/** The document's <style> blocks as one stylesheet scoped to the notes box, and the Google Fonts it uses. */
function documentStyles(page: Document): Pick<NotesDocument, 'css' | 'fonts'> {
  const fonts = new Set<string>();
  for (const link of Array.from(page.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))) {
    if (link.getAttribute('href')!.startsWith(FONTS_ORIGIN)) fonts.add(link.getAttribute('href')!);
  }
  const source = Array.from(page.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n');
  for (const [, href] of source.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)) {
    if (href!.startsWith(FONTS_ORIGIN)) fonts.add(href!);
  }
  if (!source.trim() || typeof CSSStyleSheet === 'undefined') return { css: '', fonts: [...fonts] };
  const sheet = new CSSStyleSheet();
  try {
    sheet.replaceSync(source.replace(/@import[^;]*;/g, ''));
  } catch {
    return { css: '', fonts: [...fonts] };
  }
  // Text inside <style> must never close the element.
  return { css: scopeRules(sheet.cssRules).replace(/<\/style/gi, '<\\/style'), fonts: [...fonts] };
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
  if (!html || typeof window === 'undefined') return { html: '', sections: [], css: '', fonts: [] };
  // The document's own <head> styles are kept, scoped to the notes box (see documentStyles).
  const styles = documentStyles(new DOMParser().parseFromString(html, 'text/html'));
  // Whole documents (<html><head><style>…) come back as their body; scripts, styles and event handlers are dropped.
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'link'] });
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

  return { html: body.innerHTML, sections, ...styles };
}
