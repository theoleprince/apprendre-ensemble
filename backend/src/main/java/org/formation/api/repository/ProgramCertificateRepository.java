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

    @org.springframework.data.jpa.repository.Query("select c from ProgramCertificate c join fetch c.user join fetch c.program where lower(c.code) like :q or lower(c.user.fullName) like :q order by c.issuedAt desc")
    List<ProgramCertificate> search(String q, org.springframework.data.domain.Pageable page);

    @Query("select c from ProgramCertificate c join fetch c.program left join fetch c.classroom where c.user.id = :userId order by c.issuedAt desc")
    List<ProgramCertificate> findAllForUser(Long userId);
}
