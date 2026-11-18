export type Role =
  | 'ADMIN'
  | 'FORMATEUR'
  | 'ENSEIGNANT'
  | 'CONSEILLER_PEDAGOGIQUE'
  | 'DIRECTION_ECOLE'
  | 'PARENT'
  | 'TRAVAILLEUR_SOCIAL'
  | 'JEUNE';

export type CourseType = 'THEORIQUE' | 'PRATIQUE';
export type MediaType = 'TEXT' | 'AUDIO' | 'VIDEO';
export type CertificateLevel = 'ATTESTATION' | 'BADGE' | 'MAITRISE' | 'EXPERTISE';
export type PortfolioStatus = 'SOUMIS' | 'VALIDE' | 'A_REVOIR';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administration',
  FORMATEUR: 'Formateur·trice',
  ENSEIGNANT: 'Enseignant·e',
  CONSEILLER_PEDAGOGIQUE: 'Conseiller·ère pédagogique',
  DIRECTION_ECOLE: "Direction d'école",
  PARENT: 'Parent / éducateur·trice',
  TRAVAILLEUR_SOCIAL: 'Travailleur·se social·e',
  JEUNE: 'Jeune',
};

/** Noms d'icones SVG (voir shared/icon.component). */
export const ROLE_ICONS: Record<Role, string> = {
  ADMIN: 'settings',
  FORMATEUR: 'graduation',
  ENSEIGNANT: 'book-open',
  CONSEILLER_PEDAGOGIQUE: 'compass',
  DIRECTION_ECOLE: 'school',
  PARENT: 'family',
  TRAVAILLEUR_SOCIAL: 'heart',
  JEUNE: 'smartphone',
};

export const LEVELS: { key: CertificateLevel; label: string; short: string; icon: string; rule: string }[] = [
  { key: 'ATTESTATION', label: 'Attestation de participation', short: 'Participation', icon: 'scroll', rule: 'Suivre toutes les leçons' },
  { key: 'BADGE', label: 'Badge de micro-certification', short: 'Badge', icon: 'badge-check', rule: "Réussir l'évaluation" },
  { key: 'MAITRISE', label: 'Certification de maîtrise', short: 'Maîtrise', icon: 'medal', rule: 'Toutes les leçons + score de maîtrise' },
  { key: 'EXPERTISE', label: "Certification d'expertise", short: 'Expertise', icon: 'trophy', rule: 'Portfolio validé par un mentor' },
];

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  countryCode: string | null;
  languageCode: string | null;
  region: string | null;
  cohort: string | null;
  placementDone: boolean;
  recommendedCourseIds: number[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RefItem {
  code: string;
  name: string;
}

export interface Referentiel {
  countries: RefItem[];
  languages: RefItem[];
  learnerRoles: Role[];
}

export interface PlacementQuestion {
  id: number;
  question: string;
  options: { label: string; icon: string | null }[];
}

export interface PlacementResult {
  recommended: CourseSummary[];
  message: string;
}

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  type: CourseType;
  domainName: string | null;
  countryCode: string | null;
  languageCode: string | null;
  lessonCount: number;
  totalMinutes: number;
  mediaBytes: number;
  completedLessons: number;
  levels: CertificateLevel[];
  contentVersion: number;
  recommended: boolean;
}

export interface Lesson {
  id: number;
  position: number;
  title: string;
  mediaType: MediaType;
  mediaUrl: string | null;
  mediaSizeBytes: number;
  subtitlesUrl: string | null;
  content: string;
  practiceTask: string | null;
  durationMinutes: number;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
}

export interface CoursePackage {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  type: CourseType;
  passScore: number;
  masteryScore: number;
  expertiseEnabled: boolean;
  contentVersion: number;
  updatedAt: string;
  lessons: Lesson[];
  questions: Question[];
}

export interface ProgressItem {
  lessonId: number;
  completedAt: string;
  timeSpentSeconds: number;
  offline: boolean;
}

export interface Certificate {
  code: string;
  level: CertificateLevel | null;
  levelLabel: string;
  courseId: number | null;
  courseTitle: string;
  learnerName: string;
  scorePercent: number;
  issuedAt: string;
}

export interface SyncResponse {
  accepted: number;
  serverState: ProgressItem[];
  newCertificates: Certificate[];
}

export interface QuestionCorrection {
  questionId: number;
  correctIndex: number;
  correct: boolean;
  explanation: string | null;
}

export interface QuizResult {
  scorePercent: number;
  passed: boolean;
  mastery: boolean;
  allLessonsCompleted: boolean;
  corrections: QuestionCorrection[];
  newCertificates: Certificate[];
}

export interface Portfolio {
  id: number;
  courseId: number;
  courseTitle: string;
  lessonId: number | null;
  lessonTitle: string | null;
  learnerName: string;
  text: string | null;
  mediaUrl: string | null;
  status: PortfolioStatus;
  mentorFeedback: string | null;
  mentorName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface ForumThread {
  id: number;
  title: string;
  body: string | null;
  authorName: string;
  authorRole: Role;
  courseId: number | null;
  meetingUrl: string | null;
  meetingAt: string | null;
  pinned: boolean;
  replies: number;
  createdAt: string;
  lastActivityAt: string;
}

export interface ForumPost {
  id: number;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export interface Feedback {
  rating: number;
  clarity: number;
  usefulness: number;
  comment: string | null;
}

export interface MediaUpload {
  url: string;
  sizeBytes: number;
  contentType: string;
}

// ---------- Administration ----------
export interface CountStat {
  label: string;
  count: number;
}

export interface CourseStats {
  courseId: number;
  title: string;
  started: number;
  completed: number;
  completionRate: number;
  avgScore: number;
  avgMinutes: number;
  medianMinutes: number;
  dropouts: number;
  offlineShare: number;
  avgRating: number;
  feedbackCount: number;
}

export interface Dashboard {
  learners: number;
  active7d: number;
  loginsPerLearnerPerWeek: number;
  lessonsCompleted: number;
  offlineShare: number;
  certificates: number;
  avgRating: number;
  certificatesByLevel: CountStat[];
  learnersByRole: CountStat[];
  learnersByRegion: CountStat[];
  learnersByCohort: CountStat[];
  activityLast14Days: CountStat[];
  courses: CourseStats[];
}

export interface QuestionInsight {
  questionId: number;
  question: string;
  answers: number;
  errorRate: number;
  distribution: { option: string; count: number; correct: boolean }[];
}

export interface CourseInsights {
  courseId: number;
  title: string;
  contentVersion: number;
  attempts: number;
  questions: QuestionInsight[];
  comments: string[];
  avgRating: number;
  avgClarity: number;
  avgUsefulness: number;
}

export interface AiSuggestions {
  summary: string;
  suggestions: { target: string; problem: string; proposedChange: string; rationale: string; priority: string }[];
  model: string;
}

export interface AdminCourse {
  id: number;
  title: string;
  icon: string | null;
  type: CourseType;
  countryCode: string | null;
  languageCode: string | null;
  targetRoles: Role[];
  allowedCohorts: string[];
  published: boolean;
  lessonCount: number;
  questionCount: number;
  contentVersion: number;
  domainName: string | null;
}

export interface LessonInput {
  title: string;
  mediaType: MediaType;
  mediaUrl: string | null;
  mediaSizeBytes: number;
  subtitlesUrl: string | null;
  content: string;
  practiceTask: string | null;
  durationMinutes: number;
}

export interface QuestionInput {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
}

export interface CourseInput {
  title: string;
  description: string;
  icon: string | null;
  type: CourseType;
  countryCode: string | null;
  languageCode: string | null;
  targetRoles: Role[];
  allowedCohorts: string[];
  allowedRegions: string[];
  passScore: number;
  masteryScore: number;
  expertiseEnabled: boolean;
  published: boolean;
  lessons: LessonInput[];
  questions: QuestionInput[];
  domainId: number | null;
}

export interface LearnerRow {
  id: number;
  fullName: string;
  role: Role;
  countryCode: string | null;
  region: string | null;
  cohort: string | null;
  lastActiveAt: string | null;
}

export interface RandomizeResult {
  assigned: number;
  byRegionAndGroup: Record<string, Record<string, number>>;
}

export interface AssistantLog {
  id: number;
  userId: number;
  courseId: number | null;
  question: string;
  answer: string;
  flagged: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  at: string;
}

export function formatBytes(b: number): string {
  if (!b) return '0 Ko';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} Ko`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

// ---------- Domaines, programmes, classes, classement, fiches, suivi ----------
export type ModuleState = 'DONE' | 'IN_PROGRESS' | 'TODO' | 'LOCKED';
export type ClassroomStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';
export type LeaderboardMode = 'PUBLIC' | 'ANONYMOUS' | 'DISABLED';

export interface Domain {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
}

export interface ClassroomBrief {
  id: number;
  name: string;
  programId: number;
  programTitle: string;
  startDate: string;
  endDate: string;
  status: ClassroomStatus;
  week: number;
  totalWeeks: number;
  facilitatorName: string | null;
  memberCount: number;
  myRank: number | null;
  myPoints: number | null;
  leaderboardMode: LeaderboardMode;
  meetingUrl: string | null;
  inviteCode: string | null;
}

export interface ProgramCert {
  code: string;
  programTitle: string;
  learnerName: string;
  rank: number | null;
  classSize: number | null;
  points: number;
  issuedAt: string;
  classroomName: string | null;
}

export interface ProgramSummary {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  durationLabel: string | null;
  moduleCount: number;
  completedModules: number;
  percent: number;
  nextCourseId: number | null;
  classroom: ClassroomBrief | null;
  certificate: ProgramCert | null;
}

export interface ProgramModule {
  courseId: number;
  title: string;
  icon: string | null;
  domainName: string | null;
  type: CourseType;
  lessonCount: number;
  totalMinutes: number;
  completedLessons: number;
  levels: CertificateLevel[];
  state: ModuleState;
  unlockDate: string | null;
}

export interface ProgramDetail {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  durationLabel: string | null;
  requiredLevel: CertificateLevel;
  modules: ProgramModule[];
  domains: string[];
  classroom: ClassroomBrief | null;
  certificate: ProgramCert | null;
}

export interface LeaderRow {
  rank: number;
  name: string;
  points: number;
  lessons: number;
  quizPoints: number;
  portfolios: number;
  posts: number;
  me: boolean;
  completed: boolean;
}

export interface Leaderboard {
  classroom: ClassroomBrief;
  mode: LeaderboardMode;
  rows: LeaderRow[];
  myRow: LeaderRow | null;
}

export interface ResourceItem {
  id: number;
  title: string;
  summary: string | null;
  icon: string | null;
  content: string | null;
  fileUrl: string | null;
  domainId: number | null;
  domainName: string | null;
  targetRoles: Role[];
}

export interface School {
  id: number;
  name: string;
  countryCode: string | null;
  region: string | null;
  commune: string | null;
  staffCount: number;
}

export interface LearnerProgress {
  id: number;
  name: string;
  role: Role;
  schoolName: string | null;
  region: string | null;
  programPercent: number;
  lessonsDone: number;
  certificates: number;
  lastActiveAt: string | null;
  status: 'ACTIF' | 'RALENTI' | 'DECROCHE';
  classroomName: string | null;
  rank: number | null;
}

export interface SchoolDashboard {
  school: School;
  staff: number;
  active7d: number;
  avgProgress: number;
  dropouts: number;
  rows: LearnerProgress[];
  classrooms: ClassroomBrief[];
}

export interface MentorDashboard {
  classrooms: ClassroomBrief[];
  learners: LearnerProgress[];
  portfoliosPending: number;
  dropouts: number;
}

export interface ProgramAdmin {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  durationLabel: string | null;
  countryCode: string | null;
  targetRoles: Role[];
  courseIds: number[];
  courseTitles: string[];
  requiredLevel: CertificateLevel;
  published: boolean;
  classroomCount: number;
}

export interface ClassroomAdmin {
  id: number;
  name: string;
  programId: number;
  programTitle: string;
  facilitatorId: number | null;
  facilitatorName: string | null;
  startDate: string;
  endDate: string;
  unlockMode: 'ALL' | 'WEEKLY';
  unlockIntervalDays: number;
  leaderboardMode: LeaderboardMode;
  pointsPerLesson: number;
  pointsPerQuizPercent: number;
  pointsPerPortfolio: number;
  pointsPerPost: number;
  meetingUrl: string | null;
  inviteCode: string | null;
  status: ClassroomStatus;
  closed: boolean;
  memberIds: number[];
}

export interface UserBrief {
  id: number;
  fullName: string;
  role: Role;
  region: string | null;
  schoolName: string | null;
  cohort: string | null;
}

export const STATUS_LABELS: Record<ClassroomStatus, string> = { UPCOMING: 'À venir', ACTIVE: 'En cours', CLOSED: 'Terminée' };

export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

export function frDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
