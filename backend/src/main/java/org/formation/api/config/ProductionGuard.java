package org.formation.api.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * En production, refuse de demarrer avec une configuration dangereuse :
 * secret JWT par defaut ou trop court, mot de passe administrateur par defaut.
 * Mieux vaut un service qui ne demarre pas qu'un service dont les jetons sont falsifiables.
 */
@Component
@Profile("prod")
public class ProductionGuard implements InitializingBean {

    static final String DEFAULT_SECRET_PREFIX = "dev-secret";
    static final String DEFAULT_ADMIN_PASSWORD = "Admin123!";

    private final String jwtSecret;
    private final String adminPassword;

    public ProductionGuard(@Value("${app.jwt.secret}") String jwtSecret,
                           @Value("${app.seed.admin-password}") String adminPassword) {
        this.jwtSecret = jwtSecret;
        this.adminPassword = adminPassword;
    }

    @Override
    public void afterPropertiesSet() {
        List<String> problems = new ArrayList<>();
        if (jwtSecret == null || jwtSecret.startsWith(DEFAULT_SECRET_PREFIX) || jwtSecret.length() < 32) {
            problems.add("APP_JWT_SECRET absent, par defaut ou < 32 caracteres");
        }
        if (adminPassword == null || adminPassword.equals(DEFAULT_ADMIN_PASSWORD) || adminPassword.length() < 12) {
            problems.add("APP_ADMIN_PASSWORD absent, par defaut ou < 12 caracteres");
        }
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Configuration de production refusee : " + String.join(" ; ", problems));
        }
    }
}
