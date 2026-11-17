package org.formation.api.repository;

import org.formation.api.domain.AssistantLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssistantLogRepository extends JpaRepository<AssistantLog, Long> {
    List<AssistantLog> findTop50ByOrderByAtDesc();

    List<AssistantLog> findByFlaggedTrueOrderByAtDesc();
}
