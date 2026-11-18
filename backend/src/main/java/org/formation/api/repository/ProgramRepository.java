package org.formation.api.repository;

import org.formation.api.domain.Program;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ProgramRepository extends JpaRepository<Program, Long> {
    List<Program> findAllByOrderByIdAsc();
}
