package org.formation.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Deploiement "un seul service" (PaaS type Railway / Render) : l'application Angular compilee est servie
 * par Spring Boot depuis classpath:/static.
 * - routes Angular (/modules/1, /admin...) : renvoyees vers index.html ;
 * - index.html et fichiers du service worker : jamais en cache HTTP (sinon les mises a jour ne passent pas) ;
 * - fichiers versionnes (hash dans le nom) : cache long.
 * Sans dossier static (dev, Docker Compose avec nginx), cette configuration n'a aucun effet.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private static final String[] NO_CACHE = {"/index.html", "/ngsw.json", "/ngsw-worker.js", "/safety-worker.js",
            "/worker-basic.min.js", "/manifest.webmanifest"};

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(NO_CACHE)
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache());
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
    }

    @Bean
    FilterRegistrationBean<OncePerRequestFilter> spaForwardFilter() {
        boolean hasApp = new ClassPathResource("static/index.html").exists();
        OncePerRequestFilter filter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                String path = req.getRequestURI();
                boolean appRoute = hasApp && "GET".equals(req.getMethod())
                        && !path.startsWith("/api/") && !path.startsWith("/actuator")
                        && !path.substring(path.lastIndexOf('/') + 1).contains(".");
                if (appRoute) {
                    req.getRequestDispatcher("/index.html").forward(req, res);
                    return;
                }
                chain.doFilter(req, res);
            }
        };
        FilterRegistrationBean<OncePerRequestFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return reg;
    }
}
