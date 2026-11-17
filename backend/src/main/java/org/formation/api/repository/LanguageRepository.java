package org.formation.api.repository;

import org.formation.api.domain.Language;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LanguageRepository extends JpaRepository<Language, String> {
    List<Language> findByActiveTrueOrderByName();
}
