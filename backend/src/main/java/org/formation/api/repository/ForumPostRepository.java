package org.formation.api.repository;

import org.formation.api.domain.ForumPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ForumPostRepository extends JpaRepository<ForumPost, Long> {
    @Query("select p from ForumPost p join fetch p.author where p.thread.id = :threadId order by p.createdAt")
    List<ForumPost> findForThread(Long threadId);

    long countByThreadId(Long threadId);

    long countByAuthorIdAndCreatedAtBetween(Long authorId, java.time.Instant from, java.time.Instant to);
}
