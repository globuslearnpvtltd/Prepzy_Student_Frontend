import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

type Raw = Record<string, unknown>;

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() && !/^(null|undefined)$/.test(value.trim()) ? value.trim() : null;

const flag = (value: unknown) => value === true || toNumber(value) === 1;

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export interface NoteTopic {
  anchorId: string;
  topic: string;
}

/** One chapter's study notes (and its summary video) inside a course. */
export interface ChapterNotes {
  noteId: string;
  moduleId: string;
  moduleName: string;
  moduleOrder: number;
  courseName: string;
  description: string | null;
  /** Notes HTML (may be a whole document; the renderer keeps the body). */
  html: string;
  pdf: string | null;
  topics: NoteTopic[];
  notesReady: boolean;
  videoReady: boolean;
  thumbnail: string | null;
}

export interface SummaryVideo {
  noteId: string;
  moduleName: string;
  moduleOrder: number;
  courseName: string;
  description: string | null;
  videoUrl: string | null;
  thumbnail: string | null;
  narrations: string[];
}

export function toTopics(raw: unknown): NoteTopic[] {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Raw => !!item && typeof item === 'object')
    .map((item) => ({ anchorId: text(item.anchor_id) ?? '', topic: text(item.topic) ?? '' }))
    .filter((item) => item.anchorId && item.topic);
}

export function toChapterNotes(raw: Raw): ChapterNotes {
  return {
    noteId: String(raw.note_id ?? ''),
    moduleId: String(raw.module_id ?? ''),
    moduleName: text(raw.module_name) ?? '',
    moduleOrder: toNumber(raw.module_order),
    courseName: text(raw.course_name) ?? '',
    description: text(raw.description),
    html: typeof raw.notes_text === 'string' ? raw.notes_text : '',
    pdf: text(raw.notes_pdf),
    topics: toTopics(raw.notes_index_ref),
    notesReady: flag(raw.student_note_active),
    videoReady: flag(raw.student_video_active),
    thumbnail: text(raw.video_thumbnail),
  };
}

/** The video link is a URL, or (v1 shape) a JSON list of `{ language, link }`. */
export function toVideoUrl(raw: unknown): string | null {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    const first = parsed.find((v): v is Raw => !!v && typeof v === 'object' && !!text((v as Raw).link));
    return first ? text(first.link) : null;
  }
  return text(parsed);
}

/** Download link that makes the CDN send the PDF as an attachment. */
export const pdfDownloadUrl = (pdf: string) => `${pdf}${pdf.includes('?') ? '&' : '?'}fl_attachment=true`;

export const notesApi = {
  async courseNotes(courseId: string): Promise<ChapterNotes[]> {
    const body = assertOk(await apiClient.get<{ data?: { notes?: Raw[] } }>(`/api/v4/notes/courses/${courseId}`));
    return (body.data?.notes ?? []).map(toChapterNotes);
  },

  async summaryVideo(noteId: string): Promise<SummaryVideo> {
    // The backend re-signs expiring HeyGen links, so video_link is playable.
    const body = assertOk(await apiClient.get<{ data?: Raw }>(`/api/v4/notes/summary-video/${noteId}`));
    const notes = body.data ?? {};
    const narrations = parseJson(notes.narrations);
    return {
      noteId: String(notes.note_id ?? noteId),
      moduleName: text(notes.module_name) ?? '',
      moduleOrder: toNumber(notes.module_order),
      courseName: text(notes.course_name) ?? '',
      description: text(notes.description),
      videoUrl: toVideoUrl(notes.video_link),
      thumbnail: text(notes.video_thumbnail),
      narrations: Array.isArray(narrations) ? narrations.filter((n): n is string => typeof n === 'string' && !!n.trim()) : [],
    };
  },
};
