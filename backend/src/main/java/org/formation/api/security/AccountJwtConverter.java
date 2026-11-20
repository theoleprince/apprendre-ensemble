package org.formation.api.security;

import org.formation.api.domain.AppUser;
import org.formation.api.repository.AppUserRepository;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

/**
 * Le jeton seul ne suffit pas : a chaque requete, le compte est relu.
 * - compte desactive ou efface : refuse ;
 * - jeton d'une version d'identifiants anterieure (mot de passe, desactivation, deconnexion globale) : refuse ;
 * - le role vient de la base, pas du jeton : un changement de role s'applique immediatement.
 */
public class AccountJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AppUserRepository users;

    public AccountJwtConverter(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long id;
        try {
            id = Long.valueOf(jwt.getSubject());
        } catch (NumberFormatException e) {
            throw new InvalidBearerTokenException("Jeton invalide");
        }
        AppUser u = users.findById(id).orElseThrow(() -> new InvalidBearerTokenException("Compte inconnu"));
        if (!u.isEnabled() || u.getDeletedAt() != null) {
            throw new InvalidBearerTokenException("Compte désactivé");
        }
        Object cv = jwt.getClaims().get("cv");
        long version = cv instanceof Number n ? n.longValue() : 0L;
        if (version != u.getCredentialsVersion()) {
            throw new InvalidBearerTokenException("Session expirée : reconnectez-vous");
        }
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())), jwt.getSubject());
    }
}
