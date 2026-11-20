package org.formation.api.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitation simple par fenetre fixe (en memoire, par instance) contre la force brute sur la connexion
 * et l'abus de l'envoi d'e-mails. Pour plusieurs instances : a remplacer par un stockage partage (Redis).
 */
@Component
public class RateLimiter {

    private record Window(Instant start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /** Leve 429 si la cle a depasse {@code max} essais dans la fenetre. */
    public void check(String key, int max, Duration window) {
        Instant now = Instant.now();
        Window w = windows.compute(key, (k, old) -> old == null || old.start().plus(window).isBefore(now)
                ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (w.count() > max) {
            long wait = Math.max(1, Duration.between(now, w.start().plus(window)).toMinutes());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Trop de tentatives. Réessayez dans " + wait + " minute(s).");
        }
        if (windows.size() > 50_000) windows.entrySet().removeIf(e -> e.getValue().start().plus(window).isBefore(now));
    }

    /** Remise a zero apres un succes (ex. connexion reussie). */
    public void reset(String key) {
        windows.remove(key);
    }
}
