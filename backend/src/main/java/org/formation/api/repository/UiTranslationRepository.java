package org.formation.api.repository;

import org.formation.api.domain.UiTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UiTranslationRepository extends JpaRepository<UiTranslation, String> {
}
