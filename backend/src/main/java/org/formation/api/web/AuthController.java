package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.domain.ActivityEvent;
import org.formation.api.domain.AppUser;
import org.formation.api.domain.Audience;
import org.formation.api.domain.Role;
import org.formation.api.service.ConfigAdminService;
import org.formation.api.repository.ActivityEventRepository;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CountryRepository;
import org.formation.api.repository.LanguageRepository;
import org.formation.api.security.CurrentUser;
import org.formation.api.security.TokenService;
import org.formation.api.service.LearningService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AuthController {

    /** Roles qu'un apprenant peut choisir lui-meme a l'inscription. Les mentors sont crees par l'administration. */
    static final List<Role> LEARNER_ROLES = Arrays.stream(Role.values())
            .filter(r -> r != Role.ADMIN && r != Role.FORMATEUR && r != Role.CONSEILLER_PEDAGOGIQUE).toList();

    private final AppUserRepository users;
    private final CountryRepository countries;
    private final LanguageRepository languages;
    private final ActivityEventRepository activity;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final CurrentUser currentUser;
    private final org.formation.api.security.RateLimiter limiter;
    private final org.formation.api.repository.AudienceRepository audiences;

    public AuthController(AppUserRepository users, CountryRepository countries, LanguageRepository languages,
                          ActivityEventRepository activity, PasswordEncoder encoder, TokenService tokens,
                          CurrentUser currentUser, org.formation.api.security.RateLimiter limiter,
                          org.formation.api.repository.AudienceRepository audiences) {
        this.limiter = limiter;
        this.audiences = audiences;
        this.users = users;
        this.countries = countries;
        this.languages = languages;
        this.activity = activity;
        this.encoder = encoder;
        this.tokens = tokens;
        this.currentUser = currentUser;
    }

    @PostMapping("/auth/login")
    @Transactional
    public AuthResponse login(@Valid @RequestBody LoginRequest req, jakarta.servlet.http.HttpServletRequest http) {
        String email = req.email().trim().toLowerCase();
        // anti force brute : 10 essais / 15 min par compte, 50 par adresse IP
        limiter.check("login-ip:" + http.getRemoteAddr(), 50, java.time.Duration.ofMinutes(15));
        limiter.check("login:" + email, 10, java.time.Duration.ofMinutes(15));
        AppUser u = users.findByEmailIgnoreCase(email)
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect"));
        if (!u.isEnabled() || u.getDeletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé. Contactez votre administrateur.");
        }
        limiter.reset("login:" + email);
        u.setLastActiveAt(Instant.now());
        activity.save(new ActivityEvent(u.getId(), ActivityEvent.Type.LOGIN, 0));
        return new AuthResponse(tokens.issue(u), toDto(u));
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        // public parametrable : le role de permission vient du public, jamais d'un choix libre du client
        Role role;
        String audienceCode = null;
        if (req.audience() != null && !req.audience().isBlank()) {
            Audience a = audiences.findById(req.audience().trim()).filter(x -> x.isActive() && x.isSelfRegistration())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public inconnu"));
            role = a.getBaseRole();
            audienceCode = a.getCode();
        } else {
            role = req.role();
        }
        if (role == null || !LEARNER_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role non autorise");
        }
        if (!countries.existsById(req.countryCode()) || !languages.existsById(req.languageCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pays ou langue inconnu");
        }
        if (users.existsByEmailIgnoreCase(req.email().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un compte existe deja avec cet email");
        }
        AppUser u = new AppUser();
        u.setEmail(req.email().trim().toLowerCase());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setFullName(req.fullName().trim());
        u.setRole(role);
        u.setAudience(audienceCode);
        u.setCountryCode(req.countryCode());
        u.setLanguageCode(req.languageCode());
        u.setRegion(req.region() == null || req.region().isBlank() ? null : req.region().trim());
        u.setDataConsent(true);
        u.setLastActiveAt(Instant.now());
        users.save(u);
        activity.save(new ActivityEvent(u.getId(), ActivityEvent.Type.LOGIN, 0));
        return new AuthResponse(tokens.issue(u), toDto(u));
    }

    @GetMapping("/me")
    public UserDto me() {
        return toDto(currentUser.get());
    }

    @GetMapping("/referentiel")
    public Referentiel referentiel() {
        return new Referentiel(
                countries.findByActiveTrueOrderByName().stream().map(c -> new RefItem(c.getCode(), c.getName())).toList(),
                languages.findByActiveTrueOrderByName().stream().map(l -> new RefItem(l.getCode(), l.getName())).toList(),
                LEARNER_ROLES,
                audiences.findByActiveTrueOrderByPositionAscLabelAsc().stream().filter(Audience::isSelfRegistration)
                        .map(ConfigAdminService::toDto).toList());
    }

    static UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getCountryCode(), u.getLanguageCode(),
                u.getRegion(), u.getCohort(), u.isPlacementDone(), List.copyOf(LearningService.recommendedIds(u)), u.getAudience());
    }
}
