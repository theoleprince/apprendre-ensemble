package org.formation.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * Liens temporaires signes (HMAC-SHA256) pour les medias prives : un lecteur video ne peut pas envoyer
 * d'en-tete d'autorisation, le droit d'acces est donc porte par l'URL, pour une duree limitee.
 */
@Component
public class MediaSigner {

    static final Duration VALIDITY = Duration.ofHours(2);
    private final byte[] key;

    public MediaSigner(@Value("${app.jwt.secret}") String secret) {
        this.key = ("media:" + secret).getBytes(StandardCharsets.UTF_8);
    }

    /** URL signee pour un media prive (/api/media/{name}?exp=...&sig=...). */
    public String sign(String url) {
        if (url == null || !url.startsWith("/api/media/")) return url;
        String name = url.substring("/api/media/".length());
        long exp = Instant.now().plus(VALIDITY).getEpochSecond();
        return url + "?exp=" + exp + "&sig=" + mac(name + ":" + exp);
    }

    public boolean verify(String name, Long exp, String sig) {
        if (exp == null || sig == null || Instant.now().getEpochSecond() > exp) return false;
        return MessageDigest.isEqual(mac(name + ":" + exp).getBytes(StandardCharsets.US_ASCII), sig.getBytes(StandardCharsets.US_ASCII));
    }

    private String mac(String data) {
        try {
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(key, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(m.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
