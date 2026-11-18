package org.formation.api.repository;

import org.formation.api.domain.ProgramCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ProgramCertificateRepository extends JpaRepository<ProgramCertificate, Long> {
    Optional<ProgramCertificate> findByUserIdAndProgramId(Long userId, Long programId);

    @Query("select c from ProgramCertificate c join fetch c.user join fetch c.program left join fetch c.classroom where c.code = :code")
    Optional<ProgramCertificate> findByCode(String code);

    @Query("select c from ProgramCertificate c join fetch c.program left join fetch c.classroom where c.user.id = :userId order by c.issuedAt desc")
    List<ProgramCertificate> findAllForUser(Long userId);
}
