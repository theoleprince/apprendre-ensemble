package org.formation.api.repository;

import org.formation.api.domain.SigningKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SigningKeyRepository extends JpaRepository<SigningKey, String> {
    Optional<SigningKey> findFirstByOrderByCreatedAtAsc();
}
