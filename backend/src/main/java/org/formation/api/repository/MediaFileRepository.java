package org.formation.api.repository;

import org.formation.api.domain.MediaFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MediaFileRepository extends JpaRepository<MediaFile, String> {
    List<MediaFile> findByOwnerId(Long ownerId);
}
