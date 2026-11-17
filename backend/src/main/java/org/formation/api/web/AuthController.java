package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.domain.ActivityEvent;
import org.formation.api.domain.AppUser;
import org.formation.api.domain.Role;
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

    public AuthController(AppUserRepository users, CountryRepository countries, LanguageRepository languages,
                          ActivityEventRepository activity, PasswordEncoder encoder, TokenService tokens,
                          CurrentUser currentUser) {
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
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        AppUser u = users.findByEmailIgnoreCase(req.email().trim())
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect"));
        u.setLastActiveAt(Instant.now());
        activity.save(new ActivityEvent(u.getId(), ActivityEvent.Type.LOGIN, 0));
        return new AuthResponse(tokens.issue(u), toDto(u));
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        if (!LEARNER_ROLES.contains(req.role())) {
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
        u.setRole(req.role());
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
                LEARNER_ROLES);
    }

    static UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getCountryCode(), u.getLanguageCode(),
                u.getRegion(), u.getCohort(), u.isPlacementDone(), List.copyOf(LearningService.recommendedIds(u)));
    }
}
