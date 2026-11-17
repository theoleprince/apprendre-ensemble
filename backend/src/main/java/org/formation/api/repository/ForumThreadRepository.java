package org.formation.api.repository;

import org.formation.api.domain.ForumThread;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ForumThreadRepository extends JpaRepository<ForumThread, Long> {
    @Query("""
            select t from ForumThread t join fetch t.author
            where (t.countryCode is null or t.countryCode = :country)
            order by t.pinned desc, t.lastActivityAt desc
            """)
    List<ForumThread> findVisible(String country);
}
