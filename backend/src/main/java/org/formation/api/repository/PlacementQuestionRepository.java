package org.formation.api.repository;

import org.formation.api.domain.PlacementQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlacementQuestionRepository extends JpaRepository<PlacementQuestion, Long> {
    List<PlacementQuestion> findAllByOrderByPositionAsc();
}
