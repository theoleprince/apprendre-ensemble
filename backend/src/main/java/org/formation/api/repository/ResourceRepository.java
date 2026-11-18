package org.formation.api.repository;

import org.formation.api.domain.Resource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ResourceRepository extends JpaRepository<Resource, Long> {
    List<Resource> findAllByOrderByIdAsc();
}
