package org.formation.api.repository;

import org.formation.api.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByReference(String reference);

    Optional<Payment> findByProviderTransactionId(String providerTransactionId);

    List<Payment> findByUserIdOrderByCreatedAtDesc(Long userId);
}
