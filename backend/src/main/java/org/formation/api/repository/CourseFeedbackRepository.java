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

    /** Note moyenne et nombre d'avis par cours : [courseId, moyenne, nombre]. */
    @Query("select f.course.id, avg(f.rating), count(f) from CourseFeedback f group by f.course.id")
    List<Object[]> ratingStats();

    @Query("select f from CourseFeedback f join fetch f.user u where f.course.id in :courseIds and u.deletedAt is null order by f.createdAt desc")
    List<CourseFeedback> forCourses(java.util.Collection<Long> courseIds);

    @Query("select f from CourseFeedback f join fetch f.user u join fetch f.course where f.rating >= 4 and f.comment is not null and u.deletedAt is null order by f.createdAt desc")
    List<CourseFeedback> testimonials(org.springframework.data.domain.Pageable page);
}
