package org.formation.api;

import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.service.*;
import org.formation.api.web.dto.Dtos.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Standards ouverts : Open Badges 3.0 signes, traces xAPI, paquets de cours transferables. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:openstd;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media",
        "app.ai.enabled=false",
        "app.public-url=https://formation.exemple.org"})
@Transactional
class OpenStandardsTest {

    @Autowired OpenBadgeService badges;
    @Autowired XapiService xapi;
    @Autowired CoursePackageService packages;
    @Autowired AdminService admin;
    @Autowired CertificateRepository certificates;
    @Autowired LessonProgressRepository progress;
    @Autowired QuizAttemptRepository attempts;
    @Autowired CourseRepository courses;
    @Autowired AppUserRepository users;

    @Test
    @SuppressWarnings("unchecked")
    void certificatesAreSignedOpenBadges3VerifiableWithThePublishedKey() throws Exception {
        Certificate cert = certificates.findAll().stream().filter(c -> !c.isRevoked()).findFirst().orElseThrow();
        Map<String, Object> vc = badges.credential(cert.getCode());
        assertThat((List<String>) vc.get("type")).containsExactly("VerifiableCredential", "OpenBadgeCredential");
        assertThat((List<String>) vc.get("@context")).contains("https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json");
        Map<String, Object> subject = (Map<String, Object>) vc.get("credentialSubject");
        Map<String, Object> achievement = (Map<String, Object>) subject.get("achievement");
        assertThat(achievement.get("id")).isEqualTo("https://formation.exemple.org/api/public/achievements/"
                + cert.getCourse().getId() + "/" + cert.getLevel().name());
        // l'e-mail n'apparait jamais en clair
        assertThat(JsonMapper.builder().build().writeValueAsString(vc)).doesNotContain(cert.getUser().getEmail());

        SignedJWT jwt = SignedJWT.parse(badges.signedCredential(cert.getCode()));
        RSAKey pub = (RSAKey) JWKSet.parse(badges.jwks()).getKeyByKeyId(jwt.getHeader().getKeyID());
        assertThat(pub.isPrivate()).isFalse();
        assertThat(jwt.verify(new RSASSAVerifier(pub))).isTrue();
        assertThat(jwt.getJWTClaimsSet().getIssuer()).isEqualTo("https://formation.exemple.org/api/public/issuer");
        assertThat(jwt.getJWTClaimsSet().getJWTID()).isEqualTo(badges.credentialId(cert.getCode()));
        // une signature alteree est refusee
        String[] parts = jwt.serialize().split("\\.");
        String tampered = parts[0] + "." + parts[1].substring(0, parts[1].length() - 2) + "AA." + parts[2];
        assertThat(SignedJWT.parse(tampered).verify(new RSASSAVerifier(pub))).isFalse();

        // la cle reste la meme d'une signature a l'autre (badges verifiables dans la duree)
        assertThat(SignedJWT.parse(badges.signedCredential(cert.getCode())).getHeader().getKeyID()).isEqualTo(pub.getKeyID());
    }

    @Test
    void revokedCertificatesAreNoLongerIssuedAsBadges() {
        Certificate cert = certificates.findAll().stream().filter(c -> !c.isRevoked()).findFirst().orElseThrow();
        cert.setRevokedAt(Instant.now());
        cert.setRevokedReason("test");
        certificates.saveAndFlush(cert);
        assertThatThrownBy(() -> badges.credential(cert.getCode())).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("révoqué");
    }

    @Test
    @SuppressWarnings("unchecked")
    void xapiStatementsCoverAllLearningTracesWithStablePseudonymousIds() {
        List<Map<String, Object>> s = xapi.statements();
        long expected = progress.findAll().stream().filter(p -> p.getCompletedAt() != null).count()
                + attempts.count() + certificates.findAll().stream().filter(c -> !c.isRevoked()).count();
        assertThat(s).hasSize((int) expected);
        assertThat(s.stream().map(x -> x.get("id")).distinct().count()).isEqualTo(expected);
        assertThat(xapi.statements().getFirst().get("id")).isEqualTo(s.getFirst().get("id"));   // rejeu sans doublon
        Map<String, Object> first = s.getFirst();
        assertThat(first.get("version")).isEqualTo("1.0.3");
        Map<String, Object> actor = (Map<String, Object>) first.get("actor");
        assertThat(((Map<String, Object>) actor.get("account")).get("name").toString()).startsWith("learner-");
        String all = JsonMapper.builder().build().writeValueAsString(s);
        assertThat(all).doesNotContain("@demo.local");
        assertThat(s).anyMatch(x -> ((Map<String, Object>) x.get("verb")).get("id").equals("http://adlnet.gov/expapi/verbs/passed"));
    }

    @Test
    void coursePackageRoundTripRecreatesTheWholeCourseUnpublished() {
        Course src = courses.findAllByOrderByIdAsc().stream().filter(c -> c.getTitle().startsWith("Gérer")).findFirst().orElseThrow();
        byte[] zip = packages.export(src.getId());
        AppUser admin0 = users.findByEmailIgnoreCase("admin@demo.local").orElseThrow();
        AdminCourse imported = packages.importPackage(new MockMultipartFile("file", "cours.zip", "application/zip", zip), admin0);

        CourseInput a = admin.getCourse(src.getId());
        CourseInput b = admin.getCourse(imported.id());
        assertThat(imported.id()).isNotEqualTo(src.getId());
        assertThat(b.published()).isFalse();
        assertThat(b.title()).isEqualTo(a.title());
        assertThat(b.lessons()).extracting(LessonInput::title).containsExactlyElementsOf(a.lessons().stream().map(LessonInput::title).toList());
        assertThat(b.questions()).extracting(QuestionInput::kind).containsExactlyElementsOf(a.questions().stream().map(QuestionInput::kind).toList());
        assertThat(b.questions()).extracting(QuestionInput::lessonPosition).containsExactlyElementsOf(a.questions().stream().map(QuestionInput::lessonPosition).toList());
        assertThat(b.presentation().objectives()).isEqualTo(a.presentation().objectives());
        assertThat(b.domainId()).isEqualTo(a.domainId());

        assertThatThrownBy(() -> packages.importPackage(new MockMultipartFile("file", "x.zip", "application/zip", "pas un zip".getBytes()), admin0))
                .isInstanceOf(ResponseStatusException.class);
    }
}
