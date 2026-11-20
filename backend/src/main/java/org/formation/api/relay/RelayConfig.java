package org.formation.api.relay;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

/**
 * Active le mode relais si APP_RELAY_CENTRAL_URL est renseigne. Meme image que le serveur central :
 *   docker run -e APP_RELAY_CENTRAL_URL=https://formation.exemple.org -e APP_RELAY_DIR=/data/relay ...
 * Taches : rejeu de la file toutes les 30 s ; prechargement des medias publics (toutes les 6 h par defaut).
 */
@Configuration
@EnableScheduling
@ConditionalOnExpression("'${app.relay.central-url:}' != ''")
public class RelayConfig {

    private static final Logger log = LoggerFactory.getLogger(RelayConfig.class);

    @Bean
    RelayStore relayStore(@Value("${app.relay.dir:./data/relay}") String dir) {
        return new RelayStore(Path.of(dir));
    }

    @Bean
    RelayFilter relayFilter(@Value("${app.relay.central-url}") String central, RelayStore store) {
        log.info("MODE RELAIS : API relayee vers {}", central);
        return new RelayFilter(central, store);
    }

    /** Avant la securite locale : le relais n'authentifie pas, le central le fait. */
    @Bean
    FilterRegistrationBean<RelayFilter> relayFilterRegistration(RelayFilter f) {
        FilterRegistrationBean<RelayFilter> r = new FilterRegistrationBean<>(f);
        r.addUrlPatterns("/api/*");
        r.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return r;
    }

    @Bean
    RelayJobs relayJobs(RelayFilter filter, RelayStore store) {
        return new RelayJobs(filter, store);
    }

    public static class RelayJobs {
        private final RelayFilter filter;
        private final RelayStore store;

        RelayJobs(RelayFilter filter, RelayStore store) {
            this.filter = filter;
            this.store = store;
        }

        /** Rejoue la file dans l'ordre ; s'arrete au premier echec reseau (l'ordre est preserve). */
        @Scheduled(fixedDelayString = "${app.relay.replay-ms:30000}", initialDelay = 10000)
        public void replay() {
            for (RelayStore.Queued q : store.queue()) {
                int code = filter.replay(q);
                if (code < 0) return;
                if (code >= 400) log.warn("Relais : element refuse par le central (HTTP {}) {}", code, q.uri());
                store.done(q);
                store.lastReplay = Instant.now();
            }
        }

        /** Telecharge tous les medias publics des cours publies (manifeste du central). */
        @Scheduled(fixedDelayString = "${app.relay.prefetch-ms:21600000}", initialDelay = 20000)
        public void prefetch() {
            try {
                HttpResponse<String> r = HttpClient.newHttpClient().send(
                        HttpRequest.newBuilder(URI.create(filter.central() + "/api/public/media-manifest")).timeout(Duration.ofSeconds(30)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                if (r.statusCode() != 200) return;
                JsonNode list = JsonMapper.builder().build().readTree(r.body());
                int n = 0;
                for (JsonNode m : list) if (filter.prefetch(m.path("url").asString())) n++;
                store.lastPrefetch = Instant.now();
                store.lastPrefetchCount = n;
                log.info("Relais : {} media(s) disponibles localement", n);
            } catch (Exception e) {
                log.debug("Relais : prechargement reporte ({})", e.getMessage());
            }
        }
    }
}
