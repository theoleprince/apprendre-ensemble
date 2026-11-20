package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.PasswordResetToken;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.PasswordResetTokenRepository;
import org.formation.api.security.RateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Reinitialisation du mot de passe :
 * - par e-mail (lien valable 1 h) : la reponse est identique que le compte existe ou non (pas d'enumeration) ;
 * - par lien genere par l'administration (valable 72 h), pour les personnes sans e-mail.
 * Seule l'empreinte du jeton est stockee ; le jeton est a usage unique ; les sessions existantes sont invalidees.
 */
@Service
@Transactional
public class PasswordResetService {

    static final Duration EMAIL_VALIDITY = Duration.ofHours(1);
    static final Duration ADMIN_VALIDITY = Duration.ofHours(72);

    private final AppUserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final RateLimiter limiter;
    private final String publicUrl;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(AppUserRepository users, PasswordResetTokenRepository tokens, PasswordEncoder encoder,
                                MailService mail, RateLimiter limiter, @Value("${app.public-url}") String publicUrl) {
        this.users = users;
        this.tokens = tokens;
        this.encoder = encoder;
        this.mail = mail;
        this.limiter = limiter;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    /** Demande par l'utilisateur. Ne revele jamais si l'adresse existe. */
    public void request(String email, String clientIp) {
        String e = email == null ? "" : email.trim().toLowerCase();
        limiter.check("forgot-ip:" + clientIp, 10, Duration.ofMinutes(15));
        limiter.check("forgot-mail:" + e, 3, Duration.ofMinutes(15));
        users.findByEmailIgnoreCase(e).filter(u -> u.isEnabled() && u.getDeletedAt() == null).ifPresent(u -> {
            String link = createLink(u, EMAIL_VALIDITY);
            mail.send(u.getEmail(), "Réinitialisation de votre mot de passe",
                    "Bonjour " + u.getFullName() + ",\n\n"
                            + "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n" + link + "\n\n"
                            + "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n");
        });
    }

    /** Lien remis par l'administration (compte sans e-mail, oubli au guichet). */
    public String adminLink(AppUser u) {
        return createLink(u, ADMIN_VALIDITY);
    }

    public void reset(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le mot de passe doit contenir au moins 8 caractères");
        }
        PasswordResetToken t = tokens.findByTokenHash(hash(token == null ? "" : token))
                .filter(x -> x.getUsedAt() == null && x.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien invalide ou expiré"));
        AppUser u = t.getUser();
        if (!u.isEnabled() || u.getDeletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien invalide ou expiré");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        u.revokeSessions();
        users.save(u);
        t.setUsedAt(Instant.now());
        tokens.save(t);
    }

    private String createLink(AppUser u, Duration validity) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        PasswordResetToken t = new PasswordResetToken();
        t.setUser(u);
        t.setTokenHash(hash(token));
        t.setExpiresAt(Instant.now().plus(validity));
        tokens.save(t);
        return publicUrl + "/reinitialiser?token=" + token;
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
