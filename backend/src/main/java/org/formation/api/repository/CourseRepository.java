package org.formation.api.repository;

import org.formation.api.domain.Course;
import org.formation.api.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Long> {

    /** Parcours publies visibles pour un apprenant selon son pays, sa langue et son public. */
    @Query("""
            select distinct c from Course c join c.targetRoles r
            where c.published = true
              and (c.countryCode is null or c.countryCode = :country)
              and (c.languageCode is null or c.languageCode = :language)
              and r = :role
            order by c.id
            """)
    List<Course> findVisibleFor(@Param("country") String country,
                                @Param("language") String language,
                                @Param("role") Role role);

    List<Course> findAllByOrderByIdAsc();
}
