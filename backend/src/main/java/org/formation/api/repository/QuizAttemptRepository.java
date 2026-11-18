package org.formation.api.repository;

import org.formation.api.domain.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    long countByPassedTrue();

    List<QuizAttempt> findByUserId(Long userId);

    List<QuizAttempt> findByCourseId(Long courseId);

    Optional<QuizAttempt> findTopByUserIdAndCourseIdOrderByScorePercentDesc(Long userId, Long courseId);

    @Query("select a from QuizAttempt a join fetch a.user join fetch a.course order by a.id")
    List<QuizAttempt> findAllForExport();
}
