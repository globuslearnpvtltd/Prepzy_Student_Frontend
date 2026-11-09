/** Schools (teacher) portal: API, hooks and helpers. The screens live in ./ui. */
export { schoolsApi } from './api';
export type {
  AssessmentsSummary,
  ClassStats,
  DoubtsSummary,
  FeatureUsage,
  LearningHours,
  LectureCompletion,
  School,
  SchoolClass,
  StudentProfile,
  StudentSummary,
  Teacher,
} from './api';
export { schoolsKeys, useTeacher, useTeacherLogout, useRequestTeacherOtp, useVerifyTeacherOtp } from './hooks';
export { schoolsRoutes } from './model';
