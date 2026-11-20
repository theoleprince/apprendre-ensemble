package org.formation.api.repository;

import org.formation.api.domain.Audience;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AudienceRepository extends JpaRepository<Audience, String> {
    List<Audience> findAllByOrderByPositionAscLabelAsc();

    List<Audience> findByActiveTrueOrderByPositionAscLabelAsc();
}
