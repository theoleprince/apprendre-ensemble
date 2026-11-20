package org.formation.api.relay;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Mode SERVEUR RELAIS (lieu sans Internet permanent : ecole, centre social). Toute l'API /api/** est relayee vers
 * le serveur central :
 * <ul>
 *   <li>lectures (GET) : transmises au central et mises en cache ; servies depuis le cache quand le lien est coupe ;</li>
 *   <li>synchronisation de progression, portfolio texte, avis : mis en file locale quand le central est injoignable,
 *       rejoues dans l'ordre au retour du lien (la synchronisation est idempotente cote central) ;</li>
 *   <li>autres ecritures (inscription, evaluation finale, connexion) : necessitent le lien (503 explicite).</li>
 * </ul>
 * Le relais ne decide de rien : le central reste seul juge (droits, ordre des lecons, certificats).
 */
public class RelayFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RelayFilter.class);
    private static final Set<String> HOP = Set.of("connection", "content-length", "host", "transfer-encoding", "keep-alive", "upgrade",
            "expect", "te", "trailer", "proxy-authorization", "proxy-authenticate");
    /** Ecritures acceptees hors lien : rejouables sans risque (idempotentes) ou sans reponse attendue. */
    private static final Pattern QUEUEABLE = Pattern.compile("^/api/(sync/progress|portfolio|courses/\\d+/feedback)$");

    private final String central;
    private final RelayStore store;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper json = JsonMapper.builder().build();

    public RelayFilter(String central, RelayStore store) {
        this.central = central.replaceAll("/+$", "");
        this.store = store;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws IOException, ServletException {
        String path = req.getRequestURI();
        if (path.equals("/api/relay/status")) {
            writeJson(res, 200, store.status(central));
            return;
        }
        String uri = path + (req.getQueryString() == null ? "" : "?" + req.getQueryString());
        String method = req.getMethod();
        byte[] body = req.getInputStream().readAllBytes();
        String auth = req.getHeader("Authorization");
        String cacheKey = RelayStore.key(method, uri, cacheScope(path, auth));

        HttpResponse<byte[]> up = null;
        try {
            up = forward(req, method, uri, body);
        } catch (IOException e) {
            log.debug("Central injoignable : {}", e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        boolean centralDown = up == null || up.statusCode() == 502 || up.statusCode() == 503 || up.statusCode() == 504;

        if (!centralDown) {
            if ("GET".equals(method) && up.statusCode() == 200 && cacheable(path, req.getQueryString())) {
                store.cache(cacheKey, contentType(up), up.body());
                if (path.equals("/api/progress")) store.cache(RelayStore.key("STATE", "/api/progress", auth), contentType(up), up.body());
            }
            if (path.equals("/api/sync/progress") && up.statusCode() == 200) rememberServerState(auth, up.body());
            copy(up, res);
            return;
        }

        // ---------- central injoignable ----------
        if ("GET".equals(method)) {
            Optional<RelayStore.Cached> hit = store.cached(cacheKey);
            if (hit.isPresent()) {
                res.setStatus(200);
                res.setContentType(hit.get().contentType());
                res.setHeader("X-Relay-Cache", "hit");
                res.getOutputStream().write(hit.get().body());
                return;
            }
            writeJson(res, 503, Map.of("title", "Service Unavailable", "status", 503,
                    "detail", "Relais hors ligne : ce contenu n'a pas encore été téléchargé sur le relais."));
            return;
        }
        if (QUEUEABLE.matcher(path).matches() && auth != null) {
            store.enqueue(method, uri, req.getContentType(), auth, body);
            res.setHeader("X-Relay-Queued", "true");
            if (path.equals("/api/sync/progress")) {
                writeJson(res, 200, queuedSyncResponse(auth, body));
            } else {
                writeJson(res, 202, Map.of("queued", true, "message", "Enregistré sur le relais : sera transmis au retour de la connexion."));
            }
            return;
        }
        writeJson(res, 503, Map.of("title", "Service Unavailable", "status", 503,
                "detail", "Cette action nécessite la connexion au serveur central, momentanément indisponible depuis ce relais."));
    }

    HttpResponse<byte[]> forward(HttpServletRequest req, String method, String uri, byte[] body) throws IOException, InterruptedException {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(central + uri)).timeout(Duration.ofSeconds(30));
        for (String name : Collections.list(req.getHeaderNames())) {
            if (HOP.contains(name.toLowerCase(Locale.ROOT))) continue;
            for (String v : Collections.list(req.getHeaders(name))) b.header(name, v);
        }
        b.header("X-Forwarded-By", "relay");
        b.method(method, body.length == 0 ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body));
        return http.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    /** Rejoue un element de la file ; renvoie le code HTTP, ou -1 si le central est injoignable. */
    int replay(RelayStore.Queued q) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(central + q.uri())).timeout(Duration.ofSeconds(30))
                    .header("Authorization", q.auth()).header("X-Forwarded-By", "relay");
            if (q.contentType() != null) b.header("Content-Type", q.contentType());
            b.method(q.method(), HttpRequest.BodyPublishers.ofByteArray(q.body()));
            HttpResponse<byte[]> r = http.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (q.uri().equals("/api/sync/progress") && r.statusCode() == 200) rememberServerState(q.auth(), r.body());
            return r.statusCode() >= 502 && r.statusCode() <= 504 ? -1 : r.statusCode();
        } catch (IOException e) {
            return -1;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return -1;
        }
    }

    /** Telechargement d'un media public dans le cache du relais (prechargement nocturne). */
    boolean prefetch(String uri) {
        String key = RelayStore.key("GET", uri, "public");
        if (store.cached(key).isPresent()) return true;
        try {
            HttpResponse<byte[]> r = http.send(HttpRequest.newBuilder(URI.create(central + uri)).timeout(Duration.ofMinutes(10)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            if (r.statusCode() != 200) return false;
            store.cache(key, contentType(r), r.body());
            return true;
        } catch (IOException e) {
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    String central() {
        return central;
    }

    /** Reponses personnelles : cache distinct par jeton ; medias et catalogue publics : partages. */
    private static String cacheScope(String path, String auth) {
        return path.startsWith("/api/media/") || path.startsWith("/api/public/") || path.startsWith("/api/referentiel") ? "public"
                : Objects.toString(auth, "anonymous");
    }

    private static boolean cacheable(String path, String query) {
        // jamais les liens signes (medias prives) ni les exports et rapports
        return !(query != null && query.contains("sig=")) && !path.startsWith("/api/admin/") && !path.endsWith(".pdf")
                && !path.startsWith("/api/assistant");
    }

    /** Etat de progression renvoye hors lien : dernier etat connu du central + elements mis en file. */
    private Map<String, Object> queuedSyncResponse(String auth, byte[] body) {
        Map<String, JsonNode> state = new LinkedHashMap<>();
        store.cached(RelayStore.key("STATE", "/api/progress", auth)).ifPresent(c -> {
            JsonNode arr = json.readTree(c.body());
            arr.forEach(n -> state.put(n.path("lessonId").asString(), n));
        });
        int n = 0;
        JsonNode items = json.readTree(body).path("items");
        for (JsonNode it : items) {
            ObjectNode copy = ((ObjectNode) it).deepCopy();
            copy.remove("checkAnswers");
            state.putIfAbsent(it.path("lessonId").asString(), copy);
            n++;
        }
        ArrayNode arr = json.createArrayNode();
        state.values().forEach(arr::add);
        store.cache(RelayStore.key("STATE", "/api/progress", auth), "application/json", json.writeValueAsBytes(arr));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("accepted", n);
        out.put("serverState", arr);
        out.put("newCertificates", List.of());
        out.put("rejected", List.of());
        out.put("queued", true);
        return out;
    }

    private void rememberServerState(String auth, byte[] syncResponse) {
        try {
            JsonNode st = json.readTree(syncResponse).path("serverState");
            if (st.isArray()) store.cache(RelayStore.key("STATE", "/api/progress", auth), "application/json", json.writeValueAsBytes(st));
        } catch (Exception ignored) {
            // reponse inattendue : rien a memoriser
        }
    }

    private static String contentType(HttpResponse<?> r) {
        return r.headers().firstValue("Content-Type").orElse("application/octet-stream");
    }

    private static void copy(HttpResponse<byte[]> up, HttpServletResponse res) throws IOException {
        res.setStatus(up.statusCode());
        up.headers().map().forEach((k, vs) -> {
            if (!HOP.contains(k.toLowerCase(Locale.ROOT)) && !k.startsWith(":")) vs.forEach(v -> res.addHeader(k, v));
        });
        res.getOutputStream().write(up.body());
    }

    private void writeJson(HttpServletResponse res, int status, Object body) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getOutputStream().write(json.writeValueAsString(body).getBytes(StandardCharsets.UTF_8));
    }
}
