package org.formation.api.service;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.formation.api.domain.Certificate;
import org.formation.api.domain.CertificateLevel;
import org.formation.api.domain.Course;
import org.formation.api.domain.SigningKey;
import org.formation.api.repository.CertificateRepository;
import org.formation.api.repository.CourseRepository;
import org.formation.api.repository.SigningKeyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.util.*;

/**
 * Certificats au format ouvert Open Badges 3.0 (1EdTech) : identifiants verifiables W3C (VC 2.0),
 * signes en VC-JWT (RS256). Tout portefeuille ou registre compatible peut les importer et les verifier
 * avec la cle publique (JWKS) de l'emetteur, sans dependre de la plateforme.
 * L'adresse e-mail de la personne n'apparait jamais en clair : seule une empreinte salee est publiee.
 */
@Service
public class OpenBadgeService {

    static final List<String> CONTEXT = List.of(
            "https://www.w3.org/ns/credentials/v2",
            "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json");

    private final CertificateRepository certificates;
    private final CourseRepository courses;
    private final SigningKeyRepository keys;
    private final String publicUrl;
    private final BrandingService branding;
    private final String configuredJwk;
    private volatile RSAKey key;

    public OpenBadgeService(CertificateRepository certificates, CourseRepository courses, SigningKeyRepository keys,
                            @Value("${app.public-url:http://localhost:4200}") String publicUrl,
                            BrandingService branding,
                            @Value("${app.badges.signing-jwk:}") String configuredJwk) {
        this.certificates = certificates;
        this.courses = courses;
        this.keys = keys;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
        this.branding = branding;
        this.configuredJwk = configuredJwk;
    }

    // ---------- emetteur ----------
    public String issuerId() {
        return publicUrl + "/api/public/issuer";
    }

    public Map<String, Object> issuer() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("@context", CONTEXT);
        p.put("id", issuerId());
        p.put("type", List.of("Profile"));
        p.put("name", brand());
        p.put("url", publicUrl);
        p.put("image", image());
        return p;
    }

    public Map<String, Object> jwks() {
        return new JWKSet(signingKey().toPublicJWK()).toJSONObject();
    }

    // ---------- realisation (ce que certifie le badge) ----------
    @Transactional(readOnly = true)
    public Map<String, Object> achievement(Long courseId, CertificateLevel level) {
        Course c = courses.findById(courseId).filter(Course::isPublished)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        Map<String, Object> a = achievementBody(c, level);
        a.put("@context", CONTEXT);
        return a;
    }

    private Map<String, Object> achievementBody(Course c, CertificateLevel level) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("id", publicUrl + "/api/public/achievements/" + c.getId() + "/" + level.name());
        a.put("type", List.of("Achievement"));
        a.put("achievementType", switch (level) {
            case ATTESTATION -> "Certificate";
            case BADGE -> "Badge";
            case MAITRISE, EXPERTISE -> "Certification";
        });
        a.put("name", level.label() + " - " + c.getTitle());
        a.put("description", c.getDescription() == null ? c.getTitle() : c.getDescription());
        a.put("criteria", Map.of("narrative", criteria(c, level)));
        a.put("image", image());
        a.put("creator", Map.of("id", issuerId(), "type", List.of("Profile"), "name", brand()));
        if (c.getLanguageCode() != null) a.put("inLanguage", c.getLanguageCode());
        return a;
    }

    static String criteria(Course c, CertificateLevel level) {
        return switch (level) {
            case ATTESTATION -> "Avoir suivi toutes les leçons du cours, chacune validée par son quiz.";
            case BADGE -> "Avoir réussi l'évaluation finale du cours avec au moins " + c.getPassScore() + " %.";
            case MAITRISE -> "Avoir suivi toutes les leçons et obtenu au moins " + c.getMasteryScore() + " % à l'évaluation finale.";
            case EXPERTISE -> "Avoir atteint la maîtrise et fait valider un exercice pratique (portfolio) par un mentor.";
        };
    }

    // ---------- certificat ----------
    @Transactional(readOnly = true)
    public Map<String, Object> credential(String code) {
        Certificate cert = certificates.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificat introuvable"));
        if (cert.isRevoked()) throw new ResponseStatusException(HttpStatus.GONE, "Ce certificat a été révoqué");
        Map<String, Object> vc = new LinkedHashMap<>();
        vc.put("@context", CONTEXT);
        vc.put("id", credentialId(code));
        vc.put("type", List.of("VerifiableCredential", "OpenBadgeCredential"));
        vc.put("issuer", Map.of("id", issuerId(), "type", List.of("Profile"), "name", brand(), "url", publicUrl));
        vc.put("validFrom", cert.getIssuedAt().toString());
        vc.put("name", cert.getLevel().label() + " - " + cert.getCourse().getTitle());

        String salt = salt(code);
        List<Map<String, Object>> identifiers = new ArrayList<>();
        identifiers.add(Map.of("type", "IdentityObject", "identityType", "emailAddress", "hashed", true,
                "salt", salt, "identityHash", "sha256$" + sha256(cert.getUser().getEmail().toLowerCase(Locale.ROOT) + salt)));
        identifiers.add(Map.of("type", "IdentityObject", "identityType", "name", "hashed", false,
                "identityHash", cert.getUser().getFullName()));
        Map<String, Object> subject = new LinkedHashMap<>();
        subject.put("type", List.of("AchievementSubject"));
        subject.put("identifier", identifiers);
        subject.put("achievement", achievementBody(cert.getCourse(), cert.getLevel()));
        if (cert.getLevel() != CertificateLevel.ATTESTATION && cert.getScorePercent() > 0) {
            subject.put("result", List.of(Map.of("type", List.of("Result"), "value", cert.getScorePercent() + " %")));
        }
        vc.put("credentialSubject", subject);
        vc.put("evidence", List.of(Map.of("id", publicUrl + "/verifier/" + code, "type", List.of("Evidence"),
                "name", "Page de vérification publique du certificat")));
        return vc;
    }

    /** Certificat signe (VC-JWT, RS256), verifiable avec la cle publique publiee a /api/public/issuer/jwks. */
    @Transactional(readOnly = true)
    public String signedCredential(String code) {
        Map<String, Object> vc = credential(code);
        Certificate cert = certificates.findByCode(code).orElseThrow();
        try {
            RSAKey k = signingKey();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(issuerId())
                    .jwtID(credentialId(code))
                    .notBeforeTime(Date.from(cert.getIssuedAt()))
                    .issueTime(Date.from(cert.getIssuedAt()))
                    .claim("vc", vc)
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(k.getKeyID()).type(JOSEObjectType.JWT).build(), claims);
            jwt.sign(new RSASSASigner(k));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Signature du badge impossible", e);
        }
    }

    public String credentialId(String code) {
        return publicUrl + "/api/public/certificates/" + code + "/badge";
    }

    /** Cle de signature : fournie par la configuration, sinon generee une fois puis conservee en base. */
    synchronized RSAKey signingKey() {
        if (key != null) return key;
        try {
            if (configuredJwk != null && !configuredJwk.isBlank()) {
                key = RSAKey.parse(configuredJwk);
            } else {
                Optional<SigningKey> stored = keys.findFirstByOrderByCreatedAtAsc();
                if (stored.isPresent()) {
                    key = RSAKey.parse(stored.get().getJwk());
                } else {
                    RSAKey k = new RSAKeyGenerator(2048).keyUse(KeyUse.SIGNATURE).keyIDFromThumbprint(true).generate();
                    SigningKey s = new SigningKey();
                    s.setKid(k.getKeyID());
                    s.setJwk(k.toJSONString());
                    keys.save(s);
                    key = k;
                }
            }
            return key;
        } catch (ParseException | JOSEException e) {
            throw new IllegalStateException("Clé de signature des badges invalide", e);
        }
    }

    private String brand() {
        var b = branding.current();
        return b.organization() != null ? b.organization() : b.name();
    }

    private Map<String, Object> image() {
        return Map.of("id", publicUrl + "/icons/icon-512x512.png", "type", "Image");
    }

    private static String salt(String code) {
        return sha256("badge-salt:" + code).substring(0, 16);
    }

    static String sha256(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
