package org.formation.api.repository;

import org.formation.api.domain.LicenceCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LicenceCodeRepository extends JpaRepository<LicenceCode, Long> {
    Optional<LicenceCode> findByCodeIgnoreCase(String code);

    List<LicenceCode> findAllByOrderByCreatedAtDesc();
}
