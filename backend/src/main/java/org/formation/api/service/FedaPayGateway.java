package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Payment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Client de l'API FedaPay (paiements Mobile Money et carte, Benin et Afrique de l'Ouest).
 * Doc : https://docs.fedapay.com/api-reference
 * Configuration : FEDAPAY_SECRET_KEY (sk_sandbox_... ou sk_live_...), FEDAPAY_ENV (sandbox | live),
 * FEDAPAY_WEBHOOK_SECRET (wh_...). Sans cle : le paiement en ligne est indisponible (aucune simulation).
 */
@Component
public class FedaPayGateway {

    private static final Logger log = LoggerFactory.getLogger(FedaPayGateway.class);
    /** Tolerance d'horodatage des webhooks (attaques par rejeu). */
    static final Duration WEBHOOK_TOLERANCE = Duration.ofMinutes(5);

    private final String secretKey;
    private final String baseUrl;
    private final String webhookSecret;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper json = JsonMapper.builder().build();

    public FedaPayGateway(@Value("${app.payment.fedapay.secret-key:}") String secretKey,
                          @Value("${app.payment.fedapay.environment:sandbox}") String environment,
                          @Value("${app.payment.fedapay.webhook-secret:}") String webhookSecret) {
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.baseUrl = "live".equalsIgnoreCase(environment) ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
    }

    public boolean configured() {
        return !secretKey.isEmpty();
    }

    public String environment() {
        return baseUrl.contains("sandbox") ? "sandbox" : "live";
    }

    public record Checkout(String transactionId, String url) {
    }

    /** Cree la transaction puis le lien de paiement securise vers lequel rediriger l'utilisateur. */
    public Checkout createCheckout(Payment p, AppUser u, String callbackUrl) {
        requireConfigured();
        Map<String, Object> customer = new LinkedHashMap<>();
        String[] names = u.getFullName().trim().split("\\s+", 2);
        customer.put("firstname", names[0]);
        customer.put("lastname", names.length > 1 ? names[1] : names[0]);
        customer.put("email", u.getEmail());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("description", p.getDescription());
        body.put("amount", p.getAmount());
        body.put("currency", Map.of("iso", p.getCurrency()));
        body.put("callback_url", callbackUrl);
        body.put("custom_metadata", Map.of("reference", p.getReference()));
        body.put("customer", customer);
        JsonNode tx = unwrap(call("POST", "/transactions", json.writeValueAsString(body)));
        String id = tx.path("id").asString();
        if (id == null || id.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Réponse du prestataire de paiement invalide");
        JsonNode token = call("POST", "/transactions/" + id + "/token", "{}");
        String url = token.path("url").asString();
        if (url == null || url.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Lien de paiement non fourni");
        return new Checkout(id, url);
    }

    public record TxState(String status, long amount) {
    }

    /** Etat faisant foi, lu directement chez le prestataire. */
    public TxState fetch(String transactionId) {
        requireConfigured();
        JsonNode tx = unwrap(call("GET", "/transactions/" + transactionId, null));
        return new TxState(tx.path("status").asString(), tx.path("amount").asLong());
    }

    /**
     * Verifie la signature d'un webhook : en-tete « t=horodatage,s=signature », HMAC-SHA256 de « t.corps » avec le
     * secret du point de terminaison. Le contenu n'est de toute facon pas cru : la transaction est relue via l'API.
     */
    public boolean verifyWebhook(String payload, String header) {
        if (webhookSecret.isEmpty() || header == null || payload == null) return false;
        String t = null;
        String s = null;
        for (String part : header.split(",")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length != 2) continue;
            if (kv[0].equals("t")) t = kv[1];
            if (kv[0].equals("s")) s = kv[1];
        }
        if (t == null || s == null) return false;
        try {
            long ts = Long.parseLong(t);
            if (Math.abs(Instant.now().getEpochSecond() - ts) > WEBHOOK_TOLERANCE.toSeconds()) return false;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), s.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            return false;
        }
    }

    /** Identifiant de transaction contenu dans un evenement de webhook. */
    public String transactionIdFromEvent(String payload) {
        JsonNode n = json.readTree(payload);
        JsonNode entity = n.path("entity");
        String id = entity.path("id").asString();
        return id == null || id.isBlank() ? null : id;
    }

    private JsonNode call(String method, String path, String body) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + secretKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
        b = "GET".equals(method) ? b.GET() : b.method(method, HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
        try {
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() >= 300) {
                log.warn("FedaPay {} {} -> HTTP {}", method, path, r.statusCode());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Le prestataire de paiement a refusé la demande (HTTP " + r.statusCode() + ")");
            }
            return json.readTree(r.body());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Prestataire de paiement injoignable");
        } catch (Exception e) {
            log.warn("FedaPay injoignable : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Prestataire de paiement injoignable. Réessayez plus tard.");
        }
    }

    /** Les reponses FedaPay enveloppent l'objet : {"v1/transaction": {...}}. */
    private static JsonNode unwrap(JsonNode n) {
        JsonNode inner = n.path("v1/transaction");
        return inner.isMissingNode() || inner.isNull() ? n : inner;
    }

    private void requireConfigured() {
        if (!configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Paiement en ligne non configuré sur ce serveur. Utilisez un code de licence ou contactez l'administration.");
        }
    }
}
