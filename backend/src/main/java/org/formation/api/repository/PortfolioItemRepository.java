package org.formation.api.repository;

import org.formation.api.domain.PortfolioItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PortfolioItemRepository extends JpaRepository<PortfolioItem, Long> {
    @Query("select p from PortfolioItem p join fetch p.course left join fetch p.lesson where p.user.id = :userId order by p.submittedAt desc")
    List<PortfolioItem> findAllForUser(Long userId);

    @Query("select p from PortfolioItem p join fetch p.user join fetch p.course left join fetch p.lesson where p.status = :status order by p.submittedAt")
    List<PortfolioItem> findByStatusForReview(PortfolioItem.Status status);

    long countByUserIdAndStatusAndCourseIdIn(Long userId, PortfolioItem.Status status, java.util.Collection<Long> courseIds);

    boolean existsByUserIdAndCourseIdAndStatus(Long userId, Long courseId, PortfolioItem.Status status);
}
