package org.formation.api.repository;

import org.formation.api.domain.LessonProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    Optional<LessonProgress> findByUserIdAndLessonId(Long userId, Long lessonId);

    @Query("select p from LessonProgress p join fetch p.lesson l join fetch l.course where p.user.id = :userId")
    List<LessonProgress> findAllForUser(Long userId);

    long countByUserIdAndLessonCourseId(Long userId, Long courseId);

    @Query("select p from LessonProgress p join fetch p.user join fetch p.lesson l join fetch l.course order by p.id")
    List<LessonProgress> findAllForExport();
}
