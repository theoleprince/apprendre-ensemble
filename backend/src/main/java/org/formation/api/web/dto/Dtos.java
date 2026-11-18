package org.formation.api.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.formation.api.domain.CertificateLevel;
import org.formation.api.domain.Classroom;
import org.formation.api.domain.CourseType;
import org.formation.api.domain.MediaType;
import org.formation.api.domain.PortfolioItem;
import org.formation.api.domain.Role;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Objets d'echange de l'API (les entites JPA ne sont jamais exposees directement). */
public final class Dtos {
    private Dtos() {
    }

    // ---------- Auth / profil ----------
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 120) String fullName,
            @NotNull Role role,
            @NotBlank String countryCode,
            @NotBlank String languageCode,
            @Size(max = 120) String region,
            @AssertTrue(message = "Le consentement au traitement des donnees est requis") boolean dataConsent) {
    }

    public record UserDto(Long id, String email, String fullName, Role role, String countryCode, String languageCode,
                          String region, String cohort, boolean placementDone, List<Long> recommendedCourseIds) {
    }

    public record AuthResponse(String token, UserDto user) {
    }

    // ---------- Referentiel ----------
    public record RefItem(String code, String name) {
    }

    public record Referentiel(List<RefItem> countries, List<RefItem> languages, List<Role> learnerRoles) {
    }

    // ---------- Test d'entree ----------
    public record PlacementOptionDto(String label, String icon) {
    }

    public record PlacementQuestionDto(Long id, String question, List<PlacementOptionDto> options) {
    }

    public record PlacementSubmission(@NotNull Map<Long, Integer> answers) {
    }

    public record PlacementResult(List<CourseSummary> recommended, String message) {
    }

    // ---------- Modules ----------
    public record CourseSummary(Long id, String title, String description, String icon, CourseType type, String domainName,
                                String countryCode, String languageCode, int lessonCount, int totalMinutes,
                                long mediaBytes, int completedLessons, List<CertificateLevel> levels,
                                int contentVersion, boolean recommended) {
    }

    public record LessonDto(Long id, int position, String title, MediaType mediaType, String mediaUrl,
                            long mediaSizeBytes, String subtitlesUrl, String content, String practiceTask,
                            int durationMinutes, List<CheckQuestion> checks) {
    }

    /** Test de comprehension apres une lecon : corrige sur l'appareil (fonctionne hors ligne). */
    public record CheckQuestion(Long id, String question, List<String> options, int correctIndex, String explanation) {
    }

    /** Question envoyee au client : sans la bonne reponse. */
    public record QuestionDto(Long id, String question, List<String> options) {
    }

    /** Paquet complet d'un module : telecharge une fois, consultable hors ligne. */
    public record CoursePackage(Long id, String title, String description, String icon, CourseType type,
                                int passScore, int masteryScore, boolean expertiseEnabled,
                                int contentVersion, Instant updatedAt,
                                List<LessonDto> lessons, List<QuestionDto> questions) {
    }

    // ---------- Synchronisation hors ligne ----------
    public record ProgressItem(@NotNull Long lessonId, @NotNull Instant completedAt,
                               @Min(0) @Max(86400) int timeSpentSeconds, boolean offline) {
    }

    public record SyncRequest(@NotNull @Size(max = 500) List<@Valid ProgressItem> items) {
    }

    public record SyncResponse(int accepted, List<ProgressItem> serverState, List<CertificateDto> newCertificates) {
    }

    // ---------- Evaluation / certificats ----------
    public record QuizSubmission(@NotNull List<Integer> answers) {
    }

    public record QuestionCorrection(Long questionId, int correctIndex, boolean correct, String explanation) {
    }

    public record QuizResult(int scorePercent, boolean passed, boolean mastery, boolean allLessonsCompleted,
                             List<QuestionCorrection> corrections, List<CertificateDto> newCertificates) {
    }

    public record CertificateDto(String code, CertificateLevel level, String levelLabel, Long courseId,
                                 String courseTitle, String learnerName, int scorePercent, Instant issuedAt) {
    }

    // ---------- Portfolio / mentorat ----------
    public record PortfolioInput(@NotNull Long courseId, Long lessonId, @Size(max = 4000) String text,
                                 @Size(max = 1000) String mediaUrl) {
    }

    public record PortfolioDto(Long id, Long courseId, String courseTitle, Long lessonId, String lessonTitle,
                               String learnerName, String text, String mediaUrl, PortfolioItem.Status status,
                               String mentorFeedback, String mentorName, Instant submittedAt, Instant reviewedAt) {
    }

    public record PortfolioReview(@NotNull PortfolioItem.Status status, @Size(max = 4000) String feedback) {
    }

    // ---------- Communaute ----------
    public record ThreadInput(@NotBlank @Size(max = 200) String title, @Size(max = 4000) String body, Long courseId,
                              @Size(max = 500) String meetingUrl, Instant meetingAt) {
    }

    public record PostInput(@NotBlank @Size(max = 4000) String body) {
    }

    public record ThreadDto(Long id, String title, String body, String authorName, Role authorRole, Long courseId,
                            String meetingUrl, Instant meetingAt, boolean pinned, long replies, Instant createdAt,
                            Instant lastActivityAt) {
    }

    public record PostDto(Long id, String authorName, Role authorRole, String body, Instant createdAt) {
    }

    // ---------- Retour d'experience ----------
    public record FeedbackInput(@Min(1) @Max(5) int rating, @Min(1) @Max(5) int clarity, @Min(1) @Max(5) int usefulness,
                                @Size(max = 2000) String comment) {
    }

    // ---------- Assistant IA ----------
    public record ChatMessage(@NotNull @Pattern(regexp = "user|assistant") String role,
                              @NotBlank @Size(max = 4000) String content) {
    }

    public record ChatRequest(@NotNull @Size(min = 1, max = 20) List<@Valid ChatMessage> messages,
                              Long courseId, Long lessonId) {
    }

    // ---------- Administration : modules ----------
    public record LessonInput(@NotBlank String title, MediaType mediaType, String mediaUrl, long mediaSizeBytes,
                              String subtitlesUrl, String content, String practiceTask, @Min(0) int durationMinutes) {
    }

    public record QuestionInput(@NotBlank String question, @NotNull @Size(min = 2) List<String> options,
                                @Min(0) int correctIndex, String explanation, Integer lessonPosition) {
    }

    public record CourseInput(
            @NotBlank String title,
            String description,
            String icon,
            @NotNull CourseType type,
            String countryCode,
            String languageCode,
            @NotEmpty Set<Role> targetRoles,
            Set<String> allowedCohorts,
            Set<String> allowedRegions,
            @Min(0) @Max(100) int passScore,
            @Min(0) @Max(100) int masteryScore,
            boolean expertiseEnabled,
            boolean published,
            @NotNull List<@Valid LessonInput> lessons,
            @NotNull List<@Valid QuestionInput> questions,
            Long domainId,
            @Min(0) int price) {
    }

    public record AdminCourse(Long id, String title, String icon, CourseType type, String countryCode,
                              String languageCode, Set<Role> targetRoles, Set<String> allowedCohorts,
                              boolean published, int lessonCount, int questionCount, int contentVersion, String domainName,
                              int price) {
    }

    public record MediaUpload(String url, long sizeBytes, String contentType) {
    }

    // ---------- Administration : groupes RCT ----------
    public record LearnerRow(Long id, String fullName, Role role, String countryCode, String region, String cohort,
                             Instant lastActiveAt) {
    }

    public record CohortAssign(@NotNull List<Long> userIds, String cohort) {
    }

    /** Tirage aleatoire stratifie par zone : chaque zone est repartie equitablement entre les groupes. */
    public record RandomizeRequest(@NotNull @Size(min = 2, max = 6) List<@NotBlank String> groups,
                                   Role role, String countryCode, boolean onlyUnassigned, Long seed) {
    }

    public record RandomizeResult(int assigned, Map<String, Map<String, Long>> byRegionAndGroup) {
    }

    // ---------- Tableau de bord ----------
    public record CountStat(String label, long count) {
    }

    public record CourseStats(Long courseId, String title, long started, long completed, double completionRate,
                              double avgScore, double avgMinutes, double medianMinutes, long dropouts,
                              double offlineShare, double avgRating, long feedbackCount) {
    }

    public record Dashboard(long learners, long active7d, double loginsPerLearnerPerWeek, long lessonsCompleted,
                            double offlineShare, long certificates, double avgRating,
                            List<CountStat> certificatesByLevel, List<CountStat> learnersByRole,
                            List<CountStat> learnersByRegion, List<CountStat> learnersByCohort,
                            List<CountStat> activityLast14Days, List<CourseStats> courses) {
    }

    // ---------- Boucle d'amelioration ----------
    public record OptionStat(String option, long count, boolean correct) {
    }

    public record QuestionInsight(Long questionId, String question, long answers, double errorRate,
                                  List<OptionStat> distribution) {
    }

    public record CourseInsights(Long courseId, String title, int contentVersion, long attempts,
                                 List<QuestionInsight> questions, List<String> comments, double avgRating,
                                 double avgClarity, double avgUsefulness) {
    }

    public record Suggestion(String target, String problem, String proposedChange, String rationale, String priority) {
    }

    public record AiSuggestions(String summary, List<Suggestion> suggestions, String model) {
    }

    // =====================================================================
    // Domaines, programmes, classes, classement, ressources, etablissements
    // =====================================================================
    public record DomainDto(Long id, String name, String description, String icon, int position) {
    }

    public record DomainInput(@NotBlank @Size(max = 120) String name, @Size(max = 1000) String description, String icon, int position) {
    }

    /** Etat d'un module dans un programme : DONE (niveau requis atteint), IN_PROGRESS, TODO, LOCKED (pas encore ouvert). */
    public record ProgramModule(Long courseId, String title, String icon, String domainName, CourseType type, int lessonCount,
                                int totalMinutes, int completedLessons, List<CertificateLevel> levels, String state,
                                java.time.LocalDate unlockDate) {
    }

    public record ClassroomBrief(Long id, String name, Long programId, String programTitle, java.time.LocalDate startDate,
                                 java.time.LocalDate endDate, String status, int week, int totalWeeks, String facilitatorName,
                                 int memberCount, Integer myRank, Integer myPoints, String leaderboardMode, String meetingUrl,
                                 String inviteCode) {
    }

    public record ProgramCertDto(String code, String programTitle, String learnerName, Integer rank, Integer classSize,
                                 int points, Instant issuedAt, String classroomName) {
    }

    public record ProgramSummary(Long id, String title, String description, String icon, String durationLabel, int moduleCount,
                                 int completedModules, int percent, Long nextCourseId, ClassroomBrief classroom,
                                 ProgramCertDto certificate) {
    }

    public record ProgramDetail(Long id, String title, String description, String icon, String durationLabel,
                                CertificateLevel requiredLevel, List<ProgramModule> modules, List<String> domains,
                                ClassroomBrief classroom, ProgramCertDto certificate) {
    }

    public record LeaderRow(int rank, String name, int points, int lessons, int quizPoints, int portfolios, int posts,
                            boolean me, boolean completed) {
    }

    public record Leaderboard(ClassroomBrief classroom, String mode, List<LeaderRow> rows, LeaderRow myRow) {
    }

    public record JoinRequest(@NotBlank @Size(max = 40) String code) {
    }

    public record ResourceDto(Long id, String title, String summary, String icon, String content, String fileUrl,
                              Long domainId, String domainName, Set<Role> targetRoles) {
    }

    public record ResourceInput(@NotBlank String title, String summary, String icon, String content, String fileUrl,
                                Long domainId, Set<Role> targetRoles) {
    }

    public record SchoolDto(Long id, String name, String countryCode, String region, String commune, long staffCount) {
    }

    public record SchoolInput(@NotBlank String name, String countryCode, String region, String commune) {
    }

    /** Suivi d'un apprenant : ACTIF (< 7 j), RALENTI (7-14 j), DECROCHE (> 14 j sans activite). */
    public record LearnerProgress(Long id, String name, Role role, String schoolName, String region, int programPercent,
                                  int lessonsDone, int certificates, Instant lastActiveAt, String status, String classroomName,
                                  Integer rank) {
    }

    public record SchoolDashboard(SchoolDto school, int staff, int active7d, int avgProgress, int dropouts,
                                  List<LearnerProgress> rows, List<ClassroomBrief> classrooms) {
    }

    public record MentorDashboard(List<ClassroomBrief> classrooms, List<LearnerProgress> learners, long portfoliosPending,
                                  int dropouts) {
    }

    // ---------- Administration ----------
    public record ProgramInput(@NotBlank String title, String description, String icon, String durationLabel, String countryCode,
                               @NotEmpty Set<Role> targetRoles, @NotNull List<Long> courseIds, @NotNull CertificateLevel requiredLevel,
                               boolean published, @Min(0) int price) {
    }

    public record ProgramAdmin(Long id, String title, String description, String icon, String durationLabel, String countryCode,
                               Set<Role> targetRoles, List<Long> courseIds, List<String> courseTitles,
                               CertificateLevel requiredLevel, boolean published, long classroomCount, int price) {
    }

    public record ClassroomInput(@NotBlank String name, @NotNull Long programId, Long facilitatorId,
                                 @NotNull java.time.LocalDate startDate, @NotNull java.time.LocalDate endDate,
                                 @NotNull Classroom.UnlockMode unlockMode, @Min(1) @Max(60) int unlockIntervalDays,
                                 @NotNull Classroom.LeaderboardMode leaderboardMode,
                                 @Min(0) int pointsPerLesson, @Min(0) int pointsPerQuizPercent, @Min(0) int pointsPerPortfolio,
                                 @Min(0) int pointsPerPost, @Size(max = 500) String meetingUrl) {
    }

    public record ClassroomAdmin(Long id, String name, Long programId, String programTitle, Long facilitatorId,
                                 String facilitatorName, java.time.LocalDate startDate, java.time.LocalDate endDate,
                                 Classroom.UnlockMode unlockMode, int unlockIntervalDays, Classroom.LeaderboardMode leaderboardMode,
                                 int pointsPerLesson, int pointsPerQuizPercent, int pointsPerPortfolio, int pointsPerPost,
                                 String meetingUrl, String inviteCode, String status, boolean closed, List<Long> memberIds) {
    }

    /** Ajout en masse : tous les apprenants correspondant aux filtres, ou une liste explicite. */
    public record MembersRequest(List<Long> userIds, Role role, String region, Long schoolId, String cohort) {
    }

    public record UserBrief(Long id, String fullName, Role role, String region, String schoolName, String cohort) {
    }

    // ---------- Catalogue public, inscriptions, progression ----------
    public record CatalogCourse(Long id, String title, String description, String icon, Long domainId, String domainName,
                                CourseType type, int lessonCount, int totalMinutes, int questionCount, int price,
                                Set<Role> targetRoles, boolean hasVideo, boolean hasAudio, long learners) {
    }

    public record CatalogProgram(Long id, String title, String description, String icon, String durationLabel, int courseCount,
                                 int totalMinutes, int price, Set<Role> targetRoles, CertificateLevel requiredLevel,
                                 List<String> domains) {
    }

    public record Catalog(List<CatalogProgram> programs, List<CatalogCourse> courses, List<DomainDto> domains) {
    }

    public record SyllabusItem(Long id, int position, String title, MediaType mediaType, int minutes, int checkCount,
                               boolean practice) {
    }

    public record ProgramRef(Long id, String title) {
    }

    public record CourseDetail(CatalogCourse course, List<SyllabusItem> syllabus, int passScore, int masteryScore,
                               boolean expertiseEnabled, List<ProgramRef> programs) {
    }

    public record ProgramPublicDetail(CatalogProgram program, List<CatalogCourse> courses) {
    }

    public record EnrollRequest(Long courseId, Long programId, @NotNull org.formation.api.domain.Enrollment.Method method,
                                String phone, String code) {
    }

    public record EnrollResult(Long courseId, Long programId, int amount, String paymentRef, String message) {
    }

    /** Un cours suivi : tout ce qu'il faut pour savoir ou on en est et quelle est la prochaine etape. */
    public record MyCourse(Long courseId, String title, String icon, String domainName, int lessonCount, int doneLessons,
                           int questionCount, int bestScore, boolean examPassed, int passScore, List<CertificateLevel> levels,
                           Long programId, String programTitle, String lockReason, Instant enrolledAt, int contentVersion,
                           int totalMinutes) {
    }

    public record MyProgram(Long programId, String title, String icon, String durationLabel, List<Long> courseIds,
                            int doneCourses, int percent, CertificateLevel requiredLevel, ProgramCertDto certificate,
                            ClassroomBrief classroom) {
    }

    public record MyLearning(List<MyProgram> programs, List<MyCourse> courses) {
    }
}
