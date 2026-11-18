package org.formation.api.repository;

import org.formation.api.domain.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    @Query("select e from Enrollment e left join fetch e.course left join fetch e.program where e.user.id = :userId order by e.enrolledAt")
    List<Enrollment> findAllForUser(Long userId);

    Optional<Enrollment> findByUserIdAndCourseId(Long userId, Long courseId);

    Optional<Enrollment> findByUserIdAndProgramIdAndCourseIsNull(Long userId, Long programId);

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);

    long countByCourseId(Long courseId);
}
