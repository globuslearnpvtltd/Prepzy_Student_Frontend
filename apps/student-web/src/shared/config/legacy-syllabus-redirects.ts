import { examList } from './exams';

/**
 * The previous app's syllabus / PYQ trend pages (/syllabus?class_id=&subject_id=, /trend-analysis?…) →
 * /[exam]/syllabus and /[exam]/pyq-trends. Read by next.config.ts; plain data (relative imports only) so it can be
 * unit-tested. The old routes weren't exam-scoped and only board exams have these pages, so the exam is the
 * remembered exam (cookie) when it is a board exam, else the first board exam. The query is passed on as it was;
 * the page reads subject_id and takes the class from the student's plan (class_id is ignored).
 */
type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: 'query' | 'cookie'; key: string; value: string }[];
};

/** Same cookie as src/features/auth/device.ts. */
const EXAM_COOKIE = 'prepzy_exam';

const boardExams = examList.filter((exam) => exam.category === 'board');

const toSection = (source: string, section: string): Redirect[] => [
  ...boardExams.map((exam) => ({
    source,
    has: [{ type: 'cookie' as const, key: EXAM_COOKIE, value: exam.slug }],
    destination: `/${exam.slug}/${section}`,
    permanent: false,
  })),
  ...(boardExams[0] ? [{ source, destination: `/${boardExams[0].slug}/${section}`, permanent: false }] : []),
];

export const legacySyllabusRedirects: Redirect[] = [...toSection('/syllabus', 'syllabus'), ...toSection('/trend-analysis', 'pyq-trends')];
