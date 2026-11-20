package org.formation.api.repository;

import org.formation.api.domain.Certificate;
import org.formation.api.domain.CertificateLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {
    boolean existsByUserIdAndCourseIdAndLevel(Long userId, Long courseId, CertificateLevel level);

    @Query("select c from Certificate c join fetch c.user join fetch c.course where c.code = :code")
    Optional<Certificate> findByCode(String code);

    @Query("select c from Certificate c join fetch c.course where c.user.id = :userId order by c.issuedAt desc")
    List<Certificate> findAllForUser(Long userId);

    /** Certificats valides (non revoques) : seuls a compter pour la progression et les certificats de formation. */
    @Query("select c from Certificate c join fetch c.course where c.user.id = :userId and c.revokedAt is null order by c.issuedAt desc")
    List<Certificate> findValidForUser(Long userId);

    @Query("select c from Certificate c join fetch c.user join fetch c.course where lower(c.code) like :q or lower(c.user.fullName) like :q order by c.issuedAt desc")
    List<Certificate> search(String q, org.springframework.data.domain.Pageable page);

    @Query("select c from Certificate c join fetch c.user join fetch c.course order by c.id")
    List<Certificate> findAllForExport();

    long countByRevokedAtIsNull();
}
