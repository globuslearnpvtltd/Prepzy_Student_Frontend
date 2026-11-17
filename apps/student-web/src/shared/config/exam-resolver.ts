import { env } from './env';
import { examDesignFor, getExam, type CatalogEntry, type ExamCategory, type ExamDesign } from './exams';

/** How long the server keeps GET /api/v4/exams (the backend caches it for 60 s too). */
const REVALIDATE_SECONDS = 60;

type Raw = { exam_id: number; exam_name: string; exam_slice: string; category: ExamCategory };

/** GET /api/v4/exams from the server (public endpoint, no cookies), cached by Next for a minute. */
async function fetchCatalog(): Promise<CatalogEntry[]> {
  const response = await fetch(`${env.apiUrl}/api/v4/exams`, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) throw new Error(`GET /api/v4/exams failed with ${response.status}`);
  const body = (await response.json()) as { data?: Raw[] };
  return (body.data ?? []).map((e) => ({ examId: e.exam_id, name: e.exam_name, examSlice: e.exam_slice, category: e.category }));
}

/**
 * The exam a /[exam] URL segment names, on the server (route pages decide per category). Registry exams answer
 * without a request; any other slug is looked up in the backend's active exams (slug = exam_slice). Null = 404.
 * A backend failure throws, so the page shows an error instead of caching a 404.
 */
export async function resolveExam(slug: string | undefined | null): Promise<ExamDesign | null> {
  if (!slug) return null;
  const known = getExam(slug);
  if (known) return known;
  const key = slug.toLowerCase();
  for (const entry of await fetchCatalog()) {
    const design = examDesignFor(entry);
    if (design?.slug === key) return design;
  }
  return null;
}
