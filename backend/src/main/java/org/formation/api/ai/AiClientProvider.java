package org.formation.api.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Client Claude partage. Sans identifiants configures, l'assistant bascule en mode local
 * (recherche dans les contenus du module) : la plateforme reste utilisable sans IA en ligne.
 */
@Component
public class AiClientProvider {

    private static final Logger log = LoggerFactory.getLogger(AiClientProvider.class);

    private final AnthropicClient client;
    private final String model;

    public AiClientProvider(@Value("${app.ai.api-key:}") String apiKey,
                            @Value("${app.ai.model:claude-opus-5-5}") String model,
                            @Value("${app.ai.enabled:true}") boolean enabled) {
        this.model = model;
        AnthropicClient c = null;
        if (enabled && apiKey.isBlank() && !hasAmbientCredentials()) {
            log.warn("Assistant IA en mode local : definir ANTHROPIC_API_KEY pour activer Claude");
            enabled = false;
        }
        if (enabled) {
            try {
                c = apiKey.isBlank()
                        ? AnthropicOkHttpClient.fromEnv() // ANTHROPIC_API_KEY, profil `ant auth login`, federation...
                        : AnthropicOkHttpClient.builder().apiKey(apiKey).build();
            } catch (RuntimeException e) {
                log.warn("Assistant IA en mode local : aucun identifiant Claude utilisable ({})", e.getMessage());
            }
        }
        this.client = c;
        log.info("Assistant IA : {} (modele {})", c == null ? "mode local" : "Claude", model);
    }

    /** Identifiants resolus par le SDK hors cle explicite : jeton, profil `ant auth login`, federation d'identite. */
    private static boolean hasAmbientCredentials() {
        for (String v : new String[]{"ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID"}) {
            String x = System.getenv(v);
            if (x != null && !x.isBlank()) return true;
        }
        return java.nio.file.Files.isDirectory(java.nio.file.Path.of(System.getProperty("user.home"), ".config", "anthropic"));
    }

    public Optional<AnthropicClient> client() {
        return Optional.ofNullable(client);
    }

    public String model() {
        return model;
    }
}
