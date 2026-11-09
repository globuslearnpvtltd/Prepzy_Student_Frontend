/** Helpers for the tutor's reply text: <solution> blocks, plain text for history / captions, clocks. */

export interface ReplyParts {
  spoken: string;
  solutions: string[];
  /** A <solution> is still streaming in (opening tag seen, no closing tag yet). */
  solutionOpen: boolean;
}

const SOLUTION_RE = /<solution>([\s\S]*?)<\/solution>/gi;

export function splitReply(text: string): ReplyParts {
  const solutions: string[] = [];
  let spoken = (text || '').replace(SOLUTION_RE, (_, body: string) => {
    solutions.push(body.trim());
    return ' ';
  });
  let solutionOpen = false;
  const openIdx = spoken.toLowerCase().indexOf('<solution>');
  if (openIdx !== -1) {
    solutions.push(spoken.slice(openIdx + '<solution>'.length).trim());
    spoken = spoken.slice(0, openIdx);
    solutionOpen = true;
  }
  // Hide a half-received tag at the very end of a streaming delta, e.g. "<solu".
  spoken = spoken.replace(/<\/?s?o?l?u?t?i?o?n?$/i, '');
  return { spoken: spoken.replace(/\s+/g, ' ').trim(), solutions, solutionOpen };
}

/** Chat messages are HTML; the voice agent wants plain text history. */
export function htmlToPlain(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

/** The text chats show plain text, so a <solution> block becomes a labelled paragraph (the backend stores it the same way). */
export const voiceReplyToPlain = (text: string) =>
  text.replace(/<solution>([\s\S]*?)(?:<\/solution>|$)/gi, (_, body: string) => `\n\nWorked solution:\n${body.trim()}`).trim();

export interface SpokenToken {
  kind: 'word' | 'math';
  text: string;
  display?: boolean;
}

const MATH_RE = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;

/**
 * Splits spoken text into words and whole LaTeX segments, so each can be highlighted on its own without
 * breaking a formula. An unclosed formula still streaming in is left out until it closes.
 */
export function tokenizeSpoken(spoken: string): SpokenToken[] {
  const tokens: SpokenToken[] = [];
  const pushWords = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => tokens.push({ kind: 'word', text: w }));
  let last = 0;
  let m: RegExpExecArray | null;
  MATH_RE.lastIndex = 0;
  while ((m = MATH_RE.exec(spoken))) {
    pushWords(spoken.slice(last, m.index));
    tokens.push({ kind: 'math', text: m[0], display: m[0].startsWith('\\[') });
    last = MATH_RE.lastIndex;
  }
  let rest = spoken.slice(last);
  const open = rest.search(/\\[([]/);
  if (open !== -1) rest = rest.slice(0, open);
  pushWords(rest);
  return tokens;
}

export const formatClock = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

/** "CV Raman, The Physicist" → { name: "CV Raman", title: "The Physicist" } */
export function splitAvatarName(full?: string | null) {
  const [name, ...rest] = (full || '').split(',');
  return { name: name?.trim() || 'Tutor', title: rest.join(',').trim() };
}

/** Shape + noise of the waveform bars, scaled by a real 0..1 audio level by the caller. */
export function waveAmp(i: number, t: number, n: number) {
  const shape = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.8);
  const n1 = 0.5 + 0.5 * Math.sin(t * 7.3 + i * 1.31);
  const n2 = 0.5 + 0.5 * Math.sin(t * 4.1 - i * 0.77);
  return shape * (0.25 + 0.75 * n1 * n2);
}
