import { dashboardApiBase, type ExamRef } from '@/shared/config/exams';
import type { TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; data?: T };
type Raw = Record<string, unknown>;

/* --------------------------------- helpers --------------------------------- */

export const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Trimmed string, or null for empty / "null" / "undefined" (the backend sends all three). */
export const text = (value: unknown): string | null => {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() && !/^(null|undefined)$/.test(value.trim()) ? value.trim() : null;
};

const id = (value: unknown) => (value === null || value === undefined || value === '' ? '' : String(value));

const asObject = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});

/** Arrays sometimes arrive as JSON strings. */
export function toArray(value: unknown): Raw[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed.filter((item): item is Raw => !!item && typeof item === 'object') : [];
}

const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'as']);
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/;

/** Chapter / lecture titles as the previous app showed them ("the laws of motion ii" → "The Laws of Motion II"). */
export function formatTitle(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (ROMAN.test(word)) return word.toUpperCase();
      if (index !== 0 && SMALL_WORDS.has(word)) return word;
      return word[0]!.toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/** "CLASS 12_science" → "Class 12 Science". */
export const titleCase = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');

/* ------------------------------ learning paths ------------------------------ */

/** A step in a course: what "Continue", "Next" and "Previous" lead to. */
export interface Activity {
  category: 'lecture' | 'assessment';
  id: string;
  moduleId: string | null;
  /** Assessment type (quiz, unit_test, mid_term_exam, final_exam). */
  type: string | null;
}

export function toActivity(raw: unknown): Activity | null {
  const a = asObject(raw);
  if (a.category !== 'lecture' && a.category !== 'assessment') return null;
  if (a.id === undefined || a.id === null) return null;
  return { category: a.category, id: id(a.id), moduleId: text(a.module) ?? text(a.module_id), type: text(a.type) };
}

const ASSESSMENT_TEST_TYPES: Record<string, TestTypeKey> = {
  quiz: 'quiz',
  unit_test: 'quiz',
  mid_term_exam: 'mid',
  final_exam: 'final',
};

/** The exam-engine test type that plays a course assessment, or null for unknown kinds. */
export function assessmentTestType(type: string | null | undefined): TestTypeKey | null {
  return (type && ASSESSMENT_TEST_TYPES[type]) || null;
}

const ASSESSMENT_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  unit_test: 'Unit Test',
  mid_term_exam: 'Mid Term Exams',
  final_exam: 'Final Exam',
};

export const assessmentLabel = (type: string | null | undefined) => (type && ASSESSMENT_LABELS[type]) || 'Assessment';

/** Where an activity opens: lectures in the lecture player, assessments in the exam engine. */
export function activityHref(exam: string, courseId: string, activity: Activity): string {
  if (activity.category === 'lecture') {
    return routes.lecture(exam, courseId, activity.moduleId ?? '0', activity.id);
  }
  const testType = assessmentTestType(activity.type);
  return testType ? routes.testPlayer(exam, testType, activity.id) : routes.assessments(exam);
}

/* -------------------------------- learn page -------------------------------- */

export interface LearnSubject {
  id: string;
  name: string;
  /** "Books" on the subject card. */
  courseCount: number;
  image: string | null;
  description: string | null;
}

export interface ContinueCourse {
  courseId: string;
  name: string;
  className: string;
  subjectName: string;
  image: string | null;
  percent: number;
  /** Where the student left off; null opens the course from its first chapter. */
  next: Activity | null;
}

export interface SubjectCourse {
  courseId: string;
  title: string;
  image: string | null;
  className: string;
  lectureCount: number;
  testCount: number;
  chapterCount: number;
}

/* ------------------------------- course outline ------------------------------ */

export interface OutlineChapter {
  id: string;
  title: string;
  order: number;
}

export interface OutlineExam {
  id: string;
  title: string;
  type: string | null;
}

export interface CourseOutline {
  course: { id: string; name: string; className: string; subjectName: string; classId: string } | null;
  chapters: OutlineChapter[];
  exams: OutlineExam[];
}

export interface ModuleItem {
  kind: 'lecture' | 'assessment';
  id: string;
  title: string;
  type: string | null;
  completed: boolean;
}

export interface ModuleDetail {
  title: string;
  order: number;
  description: string | null;
  items: ModuleItem[];
  /** Chapter notes and summary video, notes first (as designed). */
  summaries: { id: string; type: 'video' | 'notes' }[];
}

/* -------------------------------- questions -------------------------------- */

export interface QuestionOption {
  id: string;
  html: string;
  image: string | null;
  correct: boolean;
}

export interface SubQuestion {
  id: string;
  html: string;
  image: string | null;
  marks: number;
  answerHtml: string | null;
  answerImage: string | null;
}

export interface ChapterQuestion {
  id: string;
  type: string;
  year: string | null;
  marks: number;
  html: string;
  image: string | null;
  imageDescription: string | null;
  options: QuestionOption[];
  subQuestions: SubQuestion[];
  difficulty: 'easy' | 'medium' | 'hard' | null;
  explanation: string | null;
  sampleAnswer: string | null;
  answerImage: string | null;
}

function toSubAnswer(sub: Raw): string | null {
  const sample = text(sub.sample_answer);
  if (sample) return sample;
  const correct = toArray(sub.options).find((option) => id(option.id) === id(sub.correct_answer) && id(sub.correct_answer));
  return correct ? (text(correct.option_text) ?? text(correct.text)) : null;
}

export function toQuestion(raw: Raw, index: number): ChapterQuestion {
  const difficulty = raw.difficulty;
  return {
    id: id(raw.id) || String(index),
    type: typeof raw.type === 'string' ? raw.type : '',
    year: text(raw.year),
    marks: toNumber(raw.marks),
    html: typeof raw.question_text === 'string' ? raw.question_text : '',
    image: text(raw.question_image),
    imageDescription: text(raw.question_image_description),
    options: toArray(raw.options).map((option, i) => ({
      id: id(option.id) || String(i),
      html: text(option.option_text) ?? text(option.text) ?? '',
      image: text(option.option_image) ?? text(option.image),
      correct: option.is_correct === true || option.is_correct === 1,
    })),
    subQuestions: toArray(raw.sub_questions).map((sub, i) => ({
      id: id(sub.id) || String(i),
      html: text(sub.sub_question_text) ?? '',
      image: text(sub.sub_question_image) ?? text(sub.image),
      marks: toNumber(sub.marks),
      answerHtml: toSubAnswer(sub),
      answerImage: text(sub.sample_answer_image),
    })),
    difficulty: difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' ? difficulty : null,
    explanation: text(raw.explanation),
    sampleAnswer: text(raw.sample_answer),
    answerImage: text(raw.answer_image),
  };
}

/* --------------------------------- lectures --------------------------------- */

export interface LectureVideo {
  language: string;
  link: string;
}

export interface Lecture {
  id: string;
  title: string;
  description: string | null;
  courseId: string;
  moduleId: string;
  moduleOrder: number;
  videos: LectureVideo[];
}

export const toVideos = (raw: unknown): LectureVideo[] =>
  toArray(raw)
    .map((video) => ({ language: text(video.language) ?? '', link: text(video.link) ?? text(video.video_id) ?? '' }))
    .filter((video) => video.link);

export type VideoSource = { kind: 'youtube'; id: string; url: string } | { kind: 'file'; url: string };

const YOUTUBE_ID = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?(?:.*&)?v=))([\w-]{11})/;

/** A lecture link is a YouTube URL, a direct file URL, or (older rows) a bare HeyGen video id. */
export function resolveVideoSource(link: string | null | undefined): VideoSource | null {
  const value = link?.trim();
  if (!value) return null;
  const youtubeId = YOUTUBE_ID.exec(value)?.[1];
  if (youtubeId) return { kind: 'youtube', id: youtubeId, url: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1` };
  if (/^https?:\/\//i.test(value)) return { kind: 'file', url: value };
  return { kind: 'file', url: `https://resource2.heygen.ai/video/${value}/1280x720.mp4` };
}

/* --------------------------------- courses --------------------------------- */

export interface ClassOption {
  id: string;
  title: string;
}

export interface Textbook {
  id: string;
  classId: string;
  className: string;
  name: string;
  subjectName: string;
  image: string | null;
  description: string;
}

export interface TextbookSubject {
  id: string;
  name: string;
  textbooks: Textbook[];
}

export interface CourseDetail {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  title: string;
  description: string;
  image: string | null;
  lectureCount: number;
  quizCount: number;
  outcomes: string[];
}

export interface CurriculumSection {
  key: string;
  title: string;
  /** Lessons and tests under a chapter (exams have none). */
  items: { title: string; label: string; lecture: boolean }[];
}

function toOutcomes(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [parsed as string];
    }
  }
  return Array.isArray(parsed) ? parsed.filter((o): o is string => typeof o === 'string' && !!o.trim()) : [];
}

/* ----------------------------------- api ----------------------------------- */

/** A course a student without a plan can open ("My Free Courses"). */
export interface FreeCourse {
  id: string;
  title: string;
  className: string;
  subject: string;
  image: string | null;
  lessons: number;
  tests: number;
}

/** One finished chapter-PYQ test ("Your attempts" drawer). */
export interface ChapterAttempt {
  attemptId: string;
  attemptNumber: number;
  /** Score as shown: "72%" when the backend sends a number, otherwise its grade text. */
  score: string;
  date: string | null;
}

export const learnApi = {
  async chapterPyqAttempts(moduleId: string): Promise<ChapterAttempt[]> {
    const body = assertOk(await apiClient.get<{ submissions?: Raw[] }>(`/api/v1/exams/chapter-pyqs/previous-attempts/${moduleId}`));
    return (Array.isArray(body.submissions) ? body.submissions : []).map((s) => {
      const grade = text(s.grade) ?? '';
      const value = parseFloat(grade);
      return {
        attemptId: id(s.attempt_id),
        attemptNumber: toNumber(s.attempt_number),
        score: Number.isNaN(value) ? grade : `${Math.round(value)}%`,
        date: text(s.date),
      };
    });
  },

  async freeCourses(): Promise<FreeCourse[]> {
    const body = assertOk(await apiClient.get<Envelope<{ free_courses?: Raw[] }>>('/api/v1/student/free-courses'));
    return (body.data?.free_courses ?? []).map((c) => {
      const image = text(c.image);
      return {
        id: id(c.course_id),
        title: text(c.title) ?? '',
        className: text(c.class_name) ?? '',
        subject: text(c.subject_name) ?? '',
        // The previous app treated "null"/"undefined" strings as missing images.
        image: image && !/null|undefined/.test(image) ? image : null,
        lessons: toNumber(c.unique_lecture),
        tests: toNumber(c.assessment_count),
      };
    });
  },

  async subjects(exam: ExamRef, classId: number): Promise<LearnSubject[]> {
    const body = assertOk(await apiClient.get<Envelope<{ subjects?: Raw[] }>>(`${dashboardApiBase(exam)}/classes/${classId}/subjects`));
    return (body.data?.subjects ?? []).map((s) => ({
      id: id(s.subject_id),
      name: text(s.subject_name) ?? '',
      courseCount: toNumber(s.course_count),
      image: text(s.image),
      description: text(s.subject_description),
    }));
  },

  async continueCourses(exam: ExamRef, classId: number): Promise<ContinueCourse[]> {
    const body = assertOk(
      await apiClient.get<Envelope<{ courses?: Raw[] }>>(`${dashboardApiBase(exam)}/classes/${classId}/continue-courses`),
    );
    return (body.data?.courses ?? []).map((c) => ({
      courseId: id(c.course_id),
      name: text(c.course_name) ?? '',
      className: text(c.class_name) ?? '',
      subjectName: text(c.subject_name) ?? '',
      image: text(c.image),
      percent: Math.round(toNumber(c.progress_percentage)),
      next: toActivity(c.upcoming_learn_item),
    }));
  },

  async subjectCourses(classId: number, subjectId: string): Promise<SubjectCourse[]> {
    const body = assertOk(
      await apiClient.get<Envelope<{ result?: Raw[] }>>(`/api/v1/student/getCourselist-dashboard/${classId}/${subjectId}`),
    );
    const rows = Array.isArray(body.data?.result) ? body.data.result : [];
    return rows.map((c) => ({
      courseId: id(c.course_id),
      title: text(c.title) ?? '',
      image: text(c.image),
      className: text(c.class) ?? '',
      lectureCount: toNumber(c.unique_lecture),
      testCount: toNumber(c.assessment_count),
      chapterCount: toNumber(c.module_count),
    }));
  },

  async outline(courseId: string): Promise<CourseOutline> {
    const body = assertOk(
      await apiClient.get<Envelope<{ finalList?: unknown; courseDetail?: Raw }>>(`/api/v1/learn/module-outline/${courseId}`),
    );
    const list = toArray(body.data?.finalList);
    const course = body.data?.courseDetail;
    return {
      course: course
        ? {
            id: id(course.course_id),
            name: text(course.course_name) ?? '',
            className: text(course.class_name) ?? '',
            subjectName: text(course.subject_name) ?? '',
            classId: id(course.class_id),
          }
        : null,
      chapters: list
        .filter((item) => item.category === 'module')
        .map((item) => ({ id: id(item.id), title: text(item.title) ?? '', order: toNumber(item.module_order) })),
      exams: list
        .filter((item) => item.category === 'assessment')
        .map((item) => ({ id: id(item.id), title: text(item.title) ?? '', type: text(item.type) })),
    };
  },

  async module(courseId: string, moduleId: string): Promise<ModuleDetail> {
    type Data = { finalList?: unknown; module_data?: Raw; summary_videos?: unknown };
    const body = assertOk(await apiClient.get<Envelope<Data>>(`/api/v1/learn/module-details/${moduleId}/${courseId}`));
    const data = body.data ?? {};
    const moduleData = asObject(data.module_data);
    return {
      title: text(moduleData.title) ?? '',
      order: toNumber(moduleData.orders),
      description: text(moduleData.description),
      items: toArray(data.finalList)
        .filter((item) => item.category === 'lecture' || item.category === 'assessment')
        .map((item) => ({
          kind: item.category as ModuleItem['kind'],
          id: id(item.id),
          title: text(item.title) ?? '',
          type: text(item.type),
          completed: item.isCompleted === true || item.isCompleted === 1,
        })),
      summaries: toArray(data.summary_videos)
        .filter((s) => toNumber(s.student_side_active) === 1 && (s.type === 'video' || s.type === 'notes'))
        .map((s) => ({ id: id(s.id), type: s.type as 'video' | 'notes' }))
        .sort((a, b) => (a.type === b.type ? 0 : a.type === 'notes' ? -1 : 1)),
    };
  },

  async chapterPyqs(moduleId: string): Promise<ChapterQuestion[]> {
    const body = assertOk(await apiClient.get<Envelope<{ questions?: unknown }>>(`/api/v1/learn/chapter-pyqs/${moduleId}`));
    return toArray(body.data?.questions).map(toQuestion);
  },

  async ncertQuestions(moduleId: string): Promise<ChapterQuestion[]> {
    const body = assertOk(
      await apiClient.get<Envelope<{ questions?: unknown }>>(`/api/v1/learn/chapter-ncert-questions/${moduleId}`),
    );
    return toArray(body.data?.questions).map(toQuestion);
  },

  /** The NCERT card is simply hidden when the count can't be read. */
  async ncertCount(moduleId: string): Promise<number> {
    try {
      const body = await apiClient.get<Envelope<{ total?: unknown }>>(`/api/v1/learn/chapter-ncert-questions/${moduleId}/count`);
      return toNumber(body?.data?.total);
    } catch {
      return 0;
    }
  },

  async lecture(lectureId: string): Promise<Lecture> {
    const body = assertOk(await apiClient.get<Envelope<{ lecture?: Raw }>>(`/api/v1/learn/lectures/${lectureId}`));
    const lecture = asObject(body.data?.lecture);
    return {
      id: id(lecture.lecture_id) || lectureId,
      title: text(lecture.title) ?? '',
      description: text(lecture.description),
      courseId: id(lecture.course_id),
      moduleId: id(lecture.module_id),
      moduleOrder: toNumber(lecture.module_order),
      videos: toVideos(lecture.videos),
    };
  },

  /** Transcript HTML; empty when there's none (the tab then says so). */
  async transcript(lectureId: string): Promise<string> {
    try {
      const body = await apiClient.get<Envelope<{ transcript?: unknown }>>(`/api/v1/learn/transcript/${lectureId}`);
      return text(body?.data?.transcript) ?? '';
    } catch {
      return '';
    }
  },

  /** Marks the lecture done; returns the next step, or null at the end of the course. */
  async completeLecture(courseId: string, lectureId: string): Promise<Activity | null> {
    const body = assertOk(
      await apiClient.put<Envelope<{ activity?: unknown }>>(
        `/api/v1/learn/progress-update/course/${courseId}/lecture/${lectureId}/complete`,
      ),
    );
    return toActivity(body.data?.activity);
  },

  /** The step before this lecture, or null at the start (the backend answers `success: false` then). */
  async previousActivity(courseId: string, lectureId: string): Promise<Activity | null> {
    const body = await apiClient.post<Envelope<{ activity?: unknown }>>('/api/v1/learn/previousActivity', {
      category: 'lecture',
      id: lectureId,
      course_id: courseId,
    });
    return toActivity(body?.data?.activity);
  },

  /** Asks the backend for fresh signed video links (they expire); null when it has none. */
  async refreshVideos(lectureId: string): Promise<LectureVideo[] | null> {
    const body = await apiClient.post<Envelope<{ videos?: unknown }>>(`/api/lectures/${lectureId}/refresh-videos`);
    if (!body?.success || !Array.isArray(body.data?.videos)) return null;
    return toVideos(body.data.videos);
  },

  /* ----- course catalogue ----- */

  async classes(): Promise<ClassOption[]> {
    const body = assertOk(await apiClient.get<Envelope<Raw[]>>('/api/class-list'));
    return (Array.isArray(body.data) ? body.data : []).map((c) => ({
      id: id(c.class_id),
      title: [text(c.title), text(c.stream_name)].filter(Boolean).join(' - '),
    }));
  },

  /** Textbooks per subject for a class ('' = every class). */
  async textbooks(classId: string): Promise<TextbookSubject[]> {
    const body = assertOk(
      await apiClient.get<{ subject_courses?: Raw[]; data?: { subject_courses?: Raw[] } }>('/api/v2/get-textbooks', {
        params: { class_id: classId || undefined },
      }),
    );
    const subjects = body.subject_courses ?? body.data?.subject_courses ?? [];
    return subjects.map((s) => {
      const subjectName = text(s.subject_name) ?? '';
      return {
        id: id(s.subject_id),
        name: subjectName,
        textbooks: toArray(s.textbooks).map((t) => ({
          id: id(t.id),
          classId: id(t.class_id),
          className: text(t.class_name) ?? '',
          name: text(t.textbook_name) ?? '',
          subjectName,
          image: text(t.textbook_image),
          description: text(t.description) ?? '',
        })),
      };
    });
  },

  async course(courseId: string): Promise<CourseDetail> {
    const body = assertOk(await apiClient.get<Envelope<Raw>>(`/api/courses/${courseId}`));
    const c = asObject(body.data);
    const quizCount = Object.values(asObject(c.assessCounts)).reduce<number>((sum, n) => sum + toNumber(n), 0);
    return {
      id: id(c.course_id) || courseId,
      classId: id(c.class ?? c.class_id),
      className: text(c.className) ?? '',
      subjectName: text(c.subjectName) ?? '',
      title: text(c.title) ?? '',
      description: text(c.description) ?? '',
      image: text(c.image),
      lectureCount: toNumber(c.lectureCount),
      quizCount,
      outcomes: toOutcomes(c.outcomes),
    };
  },

  async curriculum(courseId: string): Promise<CurriculumSection[]> {
    const body = await apiClient.get<{ finalList?: unknown; data?: { finalList?: unknown } }>(
      `/api/course_outline_overview/${courseId}`,
    );
    return toArray(body?.finalList ?? body?.data?.finalList).map((section, index) => {
      if (section.category !== 'module') {
        return {
          key: `exam-${index}`,
          title: section.type === 'mid_term_exam' ? 'Mid Term Exam' : 'Final Exam',
          items: [],
        };
      }
      return {
        key: `module-${id(section.id) || index}`,
        title: `Chapter ${toNumber(section.module_order)} - ${titleCase(text(section.title))}`,
        items: toArray(section.lectures).map((item) => {
          const lecture = item.category === 'lecture';
          return {
            lecture,
            title: titleCase(text(item.title)),
            label: lecture ? `${toNumber(item.lecture_order)} .` : item.type === 'quiz' ? 'Quiz: .' : 'Unit Test: .',
          };
        }),
      };
    });
  },

  /** Class ids the student has a plan for (decides "Resume Course" vs "Enroll Now"). */
  async subscribedClasses(): Promise<string[]> {
    try {
      const body = await apiClient.get<Envelope<{ classIds?: unknown[] }>>('/api/subscribed-class');
      return (body?.data?.classIds ?? []).map(id);
    } catch {
      return [];
    }
  },
};
