package org.formation.api.repository;

import org.formation.api.domain.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SchoolRepository extends JpaRepository<School, Long> {
    List<School> findAllByOrderByNameAsc();
}
