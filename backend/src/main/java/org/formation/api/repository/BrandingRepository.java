package org.formation.api.repository;

import org.formation.api.domain.Branding;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrandingRepository extends JpaRepository<Branding, Long> {
}
