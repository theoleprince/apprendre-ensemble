package org.formation.api.repository;

import org.formation.api.domain.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findAllByOrderByStartDateDesc();

    Optional<Classroom> findByInviteCodeIgnoreCase(String code);

    @Query("select c from Classroom c join c.members m where m.id = :userId order by c.startDate desc")
    List<Classroom> findForMember(Long userId);

    @Query("select c from Classroom c where c.facilitator.id = :userId order by c.startDate desc")
    List<Classroom> findForFacilitator(Long userId);
}
