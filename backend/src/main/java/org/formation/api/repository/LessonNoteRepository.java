package org.formation.api.repository;

import org.formation.api.domain.LessonNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LessonNoteRepository extends JpaRepository<LessonNote, Long> {
    Optional<LessonNote> findByUserIdAndLessonId(Long userId, Long lessonId);

    @Query("select n from LessonNote n join fetch n.lesson l where n.user.id = :userId and l.course.id = :courseId")
    List<LessonNote> forCourse(Long userId, Long courseId);

    @Query("select n from LessonNote n join fetch n.lesson l join fetch l.course where n.user.id = :userId order by n.updatedAt desc")
    List<LessonNote> forUser(Long userId);

    void deleteByUserId(Long userId);
}
