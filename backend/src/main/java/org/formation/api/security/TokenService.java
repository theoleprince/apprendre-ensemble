package org.formation.api.security;

import org.formation.api.domain.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class TokenService {

    private final JwtEncoder encoder;
    private final Duration validity;

    public TokenService(JwtEncoder encoder, @Value("${app.jwt.validity-days:30}") long validityDays) {
        this.encoder = encoder;
        // Validite longue : l'apprenant peut rester hors ligne plusieurs semaines puis resynchroniser.
        this.validity = Duration.ofDays(validityDays);
    }

    public String issue(AppUser user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("formation-api")
                .issuedAt(now)
                .expiresAt(now.plus(validity))
                .subject(String.valueOf(user.getId()))
                .claim("name", user.getFullName())
                .claim("roles", List.of(user.getRole().name()))
                .claim("cv", user.getCredentialsVersion())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
