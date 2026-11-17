package org.formation.api.repository;

import org.formation.api.domain.CourseFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CourseFeedbackRepository extends JpaRepository<CourseFeedback, Long> {
    Optional<CourseFeedback> findByUserIdAndCourseId(Long userId, Long courseId);

    List<CourseFeedback> findByCourseId(Long courseId);

    @Query("select f from CourseFeedback f join fetch f.user join fetch f.course order by f.id")
    List<CourseFeedback> findAllForExport();
}
