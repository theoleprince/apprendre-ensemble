package org.formation.api.security;

import org.formation.api.domain.AppUser;
import org.formation.api.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CurrentUser {

    private final AppUserRepository users;

    public CurrentUser(AppUserRepository users) {
        this.users = users;
    }

    public Long id() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Jwt jwt) {
            return Long.valueOf(jwt.getSubject());
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    /** Utilisateur connecte, s'il y en a un (pages publiques consultables sans compte). */
    public java.util.Optional<AppUser> find() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return users.findById(Long.valueOf(jwt.getSubject()));
        }
        return java.util.Optional.empty();
    }

    public AppUser get() {
        return users.findById(id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
