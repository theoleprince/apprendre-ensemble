package org.formation.api.security;

import jakarta.servlet.http.HttpServletResponse;
import org.formation.api.domain.AppUser;
import org.formation.api.domain.Audience;
import org.formation.api.domain.Role;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.AudienceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.ClientRegistrations;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * Authentification unique (SSO) OpenID Connect : Keycloak, Azure AD / Entra ID, Google Workspace, FranceConnect,
 * annuaire d'un ministere... Activee par SSO_ISSUER_URI, SSO_CLIENT_ID, SSO_CLIENT_SECRET.
 * Flux « authorization code » sous /api (meme origine, passe par le proxy) ; au retour, l'application emet son propre
 * jeton et le transmet au navigateur dans le fragment d'URL (jamais envoye aux serveurs ni journalise).
 * Compte cree a la premiere connexion (public par defaut configurable), retrouve ensuite par son e-mail.
 */
@Configuration
public class SsoConfig {

    private static final Logger log = LoggerFactory.getLogger(SsoConfig.class);
    static final String REGISTRATION = "sso";

    @Value("${app.sso.issuer-uri:}") String issuer;
    @Value("${app.sso.client-id:}") String clientId;
    @Value("${app.sso.client-secret:}") String clientSecret;
    @Value("${app.sso.label:Connexion institutionnelle}") String label;
    @Value("${app.sso.default-audience:ENSEIGNANT}") String defaultAudience;
    @Value("${app.sso.default-country:BJ}") String defaultCountry;
    @Value("${app.public-url}") String publicUrl;

    boolean enabled() {
        return !issuer.isBlank() && !clientId.isBlank();
    }

    /** Decouverte OIDC a la premiere utilisation : une indisponibilite de l'IdP n'empeche pas l'application de demarrer. */
    @Bean
    ClientRegistrationRepository ssoRegistrations() {
        return new ClientRegistrationRepository() {
            private volatile ClientRegistration cached;

            @Override
            public ClientRegistration findByRegistrationId(String id) {
                if (!REGISTRATION.equals(id) || !enabled()) return null;
                if (cached == null) {
                    try {
                        cached = ClientRegistrations.fromIssuerLocation(issuer)
                                .registrationId(REGISTRATION)
                                .clientId(clientId)
                                .clientSecret(clientSecret)
                                .scope("openid", "profile", "email")
                                .redirectUri("{baseUrl}/api/login/oauth2/code/{registrationId}")
                                .clientName(label)
                                .build();
                    } catch (Exception e) {
                        log.warn("SSO : fournisseur d'identite injoignable ({})", e.getMessage());
                        return null;
                    }
                }
                return cached;
            }
        };
    }

    @Bean
    @Order(1)
    SecurityFilterChain ssoChain(HttpSecurity http, ClientRegistrationRepository registrations, AppUserRepository users,
                                 AudienceRepository audiences, PasswordEncoder encoder, TokenService tokens,
                                 TransactionTemplate tx) throws Exception {
        String base = publicUrl.replaceAll("/+$", "");
        http.securityMatcher("/api/oauth2/**", "/api/login/oauth2/**")
                .csrf(c -> c.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .oauth2Login(o -> o
                        .clientRegistrationRepository(registrations)
                        .authorizationEndpoint(e -> e.baseUri("/api/oauth2/authorization"))
                        .redirectionEndpoint(e -> e.baseUri("/api/login/oauth2/code/*"))
                        .successHandler((req, res, auth) -> {
                            OidcUser oidc = (OidcUser) auth.getPrincipal();
                            String email = oidc.getEmail();
                            if (email == null || email.isBlank()) {
                                res.sendRedirect(base + "/login?sso=no-email");
                                return;
                            }
                            AppUser u = tx.execute(st -> provision(users, audiences, encoder, oidc, email.trim().toLowerCase()));
                            req.getSession().invalidate();
                            if (u == null || !u.isEnabled() || u.getDeletedAt() != null) {
                                res.sendRedirect(base + "/login?sso=disabled");
                                return;
                            }
                            res.setStatus(HttpServletResponse.SC_FOUND);
                            res.sendRedirect(base + "/sso#token=" + URLEncoder.encode(tokens.issue(u), StandardCharsets.UTF_8));
                        })
                        .failureHandler((req, res, ex) -> {
                            log.warn("SSO refuse : {}", ex.getMessage());
                            res.sendRedirect(base + "/login?sso=error");
                        }));
        return http.build();
    }

    private AppUser provision(AppUserRepository users, AudienceRepository audiences, PasswordEncoder encoder, OidcUser oidc, String email) {
        return users.findByEmailIgnoreCase(email).map(u -> {
            u.setLastActiveAt(Instant.now());
            return users.save(u);
        }).orElseGet(() -> {
            Audience a = audiences.findById(defaultAudience).orElse(null);
            AppUser u = new AppUser();
            u.setEmail(email);
            String name = oidc.getFullName() != null ? oidc.getFullName()
                    : ((oidc.getGivenName() == null ? "" : oidc.getGivenName()) + " " + (oidc.getFamilyName() == null ? "" : oidc.getFamilyName())).trim();
            u.setFullName(name.isBlank() ? email : name);
            u.setRole(a != null ? a.getBaseRole() : Role.APPRENANT);
            u.setAudience(a != null ? a.getCode() : null);
            u.setCountryCode(defaultCountry);
            u.setLanguageCode("fr");
            byte[] b = new byte[24];
            new SecureRandom().nextBytes(b);
            // mot de passe local aleatoire et inconnu : la connexion se fait par le fournisseur d'identite
            u.setPasswordHash(encoder.encode(Base64.getEncoder().encodeToString(b)));
            u.setDataConsent(true);
            u.setLastActiveAt(Instant.now());
            return users.save(u);
        });
    }

    /** Le bouton « Connexion institutionnelle » n'apparait que si le SSO est configure. */
    @RestController
    static class SsoInfoController {
        private final SsoConfig cfg;

        SsoInfoController(SsoConfig cfg) {
            this.cfg = cfg;
        }

        @GetMapping("/api/public/sso")
        Map<String, Object> info() {
            return Map.of("enabled", cfg.enabled(), "label", cfg.label, "url", "/api/oauth2/authorization/" + REGISTRATION);
        }
    }
}
