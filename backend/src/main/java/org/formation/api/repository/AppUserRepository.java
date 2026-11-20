package org.formation.api.repository;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    long countByRoleAndEnabledTrue(org.formation.api.domain.Role role);

    List<AppUser> findByRoleNotIn(Collection<Role> roles);

    List<AppUser> findBySchoolId(Long schoolId);

    @org.springframework.data.jpa.repository.Query("select count(distinct u.countryCode) from AppUser u where u.countryCode is not null and u.deletedAt is null")
    long countCountries();

    List<AppUser> findByRemindersEnabledTrueAndEnabledTrueAndDeletedAtIsNull();
}
