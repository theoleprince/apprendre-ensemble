package org.formation.api.repository;

import org.formation.api.domain.Country;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CountryRepository extends JpaRepository<Country, String> {
    List<Country> findByActiveTrueOrderByName();
}
