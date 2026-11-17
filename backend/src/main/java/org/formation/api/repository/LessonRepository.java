package org.formation.api.repository;

import org.formation.api.domain.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    long countByCourseId(Long courseId);
}
