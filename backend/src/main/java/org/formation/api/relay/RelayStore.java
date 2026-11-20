package org.formation.api.relay;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;

/**
 * Stockage disque du relais : cache des reponses (contenus, medias) et file d'attente ordonnee des ecritures.
 * Fichiers simples, robustes aux coupures de courant (ecriture dans un fichier temporaire puis renommage atomique).
 */
public class RelayStore {

    public record Cached(String contentType, byte[] body) {
    }

    public record Queued(Path file, String method, String uri, String contentType, String auth, byte[] body) {
    }

    private final Path cacheDir;
    private final Path queueDir;
    private final AtomicLong seq = new AtomicLong(System.currentTimeMillis() * 1000);
    volatile Instant lastReplay;
    volatile Instant lastPrefetch;
    volatile int lastPrefetchCount;

    public RelayStore(Path root) {
        this.cacheDir = root.resolve("cache");
        this.queueDir = root.resolve("queue");
        try {
            Files.createDirectories(cacheDir);
            Files.createDirectories(queueDir);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String key(String method, String uri, String scope) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest((method + " " + uri + " " + scope).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public void cache(String key, String contentType, byte[] body) {
        try {
            Path tmp = cacheDir.resolve(key + ".tmp");
            byte[] ct = (contentType + "\n").getBytes(StandardCharsets.UTF_8);
            try (var out = Files.newOutputStream(tmp)) {
                out.write(ct);
                out.write(body);
            }
            Files.move(tmp, cacheDir.resolve(key), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            // disque plein ou indisponible : le relais continue sans cache
        }
    }

    public Optional<Cached> cached(String key) {
        Path p = cacheDir.resolve(key);
        if (!Files.isRegularFile(p)) return Optional.empty();
        try {
            byte[] all = Files.readAllBytes(p);
            int nl = 0;
            while (nl < all.length && all[nl] != '\n') nl++;
            return Optional.of(new Cached(new String(all, 0, nl, StandardCharsets.UTF_8), Arrays.copyOfRange(all, Math.min(nl + 1, all.length), all.length)));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public synchronized void enqueue(String method, String uri, String contentType, String auth, byte[] body) {
        String name = String.format("%020d.req", seq.incrementAndGet());
        StringBuilder head = new StringBuilder().append(method).append('\n').append(uri).append('\n')
                .append(Objects.toString(contentType, "")).append('\n').append(auth).append('\n');
        try {
            Path tmp = queueDir.resolve(name + ".tmp");
            try (var out = Files.newOutputStream(tmp)) {
                out.write(head.toString().getBytes(StandardCharsets.UTF_8));
                out.write(body);
            }
            Files.move(tmp, queueDir.resolve(name), StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** File dans l'ordre d'arrivee. */
    public List<Queued> queue() {
        try (Stream<Path> s = Files.list(queueDir)) {
            return s.filter(p -> p.toString().endsWith(".req")).sorted().map(this::read).filter(Objects::nonNull).toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    private Queued read(Path p) {
        try {
            byte[] all = Files.readAllBytes(p);
            int[] nl = new int[4];
            int found = 0;
            for (int i = 0; i < all.length && found < 4; i++) if (all[i] == '\n') nl[found++] = i;
            if (found < 4) return null;
            String method = new String(all, 0, nl[0], StandardCharsets.UTF_8);
            String uri = new String(all, nl[0] + 1, nl[1] - nl[0] - 1, StandardCharsets.UTF_8);
            String ct = new String(all, nl[1] + 1, nl[2] - nl[1] - 1, StandardCharsets.UTF_8);
            String auth = new String(all, nl[2] + 1, nl[3] - nl[2] - 1, StandardCharsets.UTF_8);
            return new Queued(p, method, uri, ct.isEmpty() ? null : ct, auth, Arrays.copyOfRange(all, nl[3] + 1, all.length));
        } catch (IOException e) {
            return null;
        }
    }

    public void done(Queued q) {
        try {
            Files.deleteIfExists(q.file());
        } catch (IOException ignored) {
            // sera retente
        }
    }

    public Map<String, Object> status(String central) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", "relay");
        m.put("central", central);
        m.put("queued", queue().size());
        try (Stream<Path> s = Files.list(cacheDir)) {
            List<Path> files = s.filter(Files::isRegularFile).toList();
            m.put("cachedEntries", files.size());
            m.put("cachedBytes", files.stream().mapToLong(p -> p.toFile().length()).sum());
        } catch (IOException e) {
            m.put("cachedEntries", 0);
        }
        m.put("lastReplay", lastReplay);
        m.put("lastPrefetch", lastPrefetch);
        m.put("lastPrefetchCount", lastPrefetchCount);
        return m;
    }
}
