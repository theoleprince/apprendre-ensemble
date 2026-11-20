package org.formation.api;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.security.AccountJwtConverter;
import org.formation.api.security.MediaSigner;
import org.formation.api.security.TokenService;
import org.formation.api.service.*;
import org.formation.api.web.dto.Dtos.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Comptes, sessions, mot de passe, effacement RGPD, medias prives, revocation de certificats. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:accounts;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media-accounts",
        "app.ai.enabled=false"})
@Transactional
class AccountRulesTest {

    @Autowired AppUserRepository users;
    @Autowired AccountService accounts;
    @Autowired PasswordResetService resets;
    @Autowired PasswordResetTokenRepository resetTokens;
    @Autowired TokenService tokens;
    @Autowired JwtDecoder decoder;
    @Autowired PasswordEncoder encoder;
    @Autowired MediaStorage storage;
    @Autowired MediaSigner signer;
    @Autowired CertificateRepository certificates;
    @Autowired CertificateAdminService certAdmin;
    @Autowired LearningService learning;

    private AppUser user(String email) {
        return users.findByEmailIgnoreCase(email).orElseThrow();
    }

    private AppUser admin() {
        return user("admin@demo.local");
    }

    private Jwt tokenOf(AppUser u) {
        return decoder.decode(tokens.issue(u));
    }

    @Test
    void disablingAnAccountOrChangingCredentialsRevokesExistingSessions() throws Exception {
        AppUser u = user("jeune@demo.local");
        AccountJwtConverter conv = new AccountJwtConverter(users);
        Jwt before = tokenOf(u);
        assertThat(conv.convert(before)).isNotNull();

        accounts.setEnabled(admin(), u.getId(), false);
        assertThatThrownBy(() -> conv.convert(before)).isInstanceOf(InvalidBearerTokenException.class);

        accounts.setEnabled(admin(), u.getId(), true);
        // le jeton anterieur a la reactivation reste refuse : il faut se reconnecter
        assertThatThrownBy(() -> conv.convert(before)).isInstanceOf(InvalidBearerTokenException.class);
        Thread.sleep(1100);
        assertThat(conv.convert(tokenOf(u)).getAuthorities()).extracting(Object::toString).containsExactly("ROLE_JEUNE");
    }

    @Test
    void passwordResetLinkIsSingleUseAndRevokesSessions() throws Exception {
        AppUser u = user("parent@demo.local");
        Jwt old = tokenOf(u);
        String link = accounts.resetLink(admin(), u.getId()).url();
        String token = link.substring(link.indexOf("token=") + 6);
        // le jeton n'est jamais stocke en clair
        assertThat(resetTokens.findAll()).noneMatch(t -> t.getTokenHash().equals(token));

        Thread.sleep(1100);
        resets.reset(token, "NouveauMotDePasse2026");
        assertThat(encoder.matches("NouveauMotDePasse2026", user("parent@demo.local").getPasswordHash())).isTrue();
        assertThatThrownBy(() -> new AccountJwtConverter(users).convert(old)).isInstanceOf(InvalidBearerTokenException.class);
        // usage unique
        assertThatThrownBy(() -> resets.reset(token, "EncoreUnAutre2026")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> resets.reset("inconnu", "EncoreUnAutre2026")).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void trainerCannotManageAdministratorsAndNobodyDisablesThemselves() {
        AppUser trainer = user("formateur@demo.local");
        assertThatThrownBy(() -> accounts.setEnabled(trainer, admin().getId(), false)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> accounts.create(trainer, new AdminUserInput("x@demo.local", "X", Role.ADMIN, "BJ", "fr", null, null, null, "Motdepasse123")))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> accounts.setEnabled(admin(), admin().getId(), false)).isInstanceOf(ResponseStatusException.class);
        AdminUser created = accounts.create(trainer, new AdminUserInput("mentor.nouveau@demo.local", "Nouveau Mentor",
                Role.CONSEILLER_PEDAGOGIQUE, "BJ", "fr", "Donga", null, null, null));
        assertThat(created.enabled()).isTrue();
        assertThat(accounts.list("nouveau mentor", null, null, 0, 20).items()).extracting(AdminUser::id).containsExactly(created.id());
    }

    @Test
    void erasureAnonymisesPersonalDataButKeepsPseudonymousStatistics() {
        AppUser u = user("enseignant@demo.local");
        long progressBefore = learning.serverProgress(u).size();
        assertThat(progressBefore).isPositive();
        accounts.eraseSelf(u, "Demo1234!");

        AppUser after = users.findById(u.getId()).orElseThrow();
        assertThat(after.getEmail()).startsWith("supprime-");
        assertThat(after.getFullName()).isEqualTo("Compte supprimé");
        assertThat(after.isEnabled()).isFalse();
        assertThat(after.getSchool()).isNull();
        assertThat(certificates.findAllForUser(u.getId())).isEmpty();
        assertThat(users.findByEmailIgnoreCase("enseignant@demo.local")).isEmpty();
        // donnees d'apprentissage conservees sous forme pseudonyme (evaluation d'impact)
        assertThat(learning.serverProgress(after)).hasSize((int) progressBefore);
    }

    @Test
    void wrongPasswordCannotEraseAccountAndExportContainsPersonalData() {
        AppUser u = user("jeune@demo.local");
        assertThatThrownBy(() -> accounts.eraseSelf(u, "mauvais")).isInstanceOf(ResponseStatusException.class);
        var data = accounts.export(u);
        assertThat(data).containsKeys("profile", "enrollments", "lessonsCompleted", "certificates", "portfolio");
    }

    @Test
    void learnerUploadsArePrivateAndCheckedOnContent() {
        AppUser u = user("jeune@demo.local");
        byte[] mp4 = new byte[]{0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'm', 'p', '4', '2', 0, 0, 0, 0};
        MediaUpload up = storage.store(new MockMultipartFile("file", "v.mp4", "video/mp4", mp4), u, false);
        String name = up.url().substring(up.url().lastIndexOf('/') + 1);
        assertThat(storage.isPrivate(name)).isTrue();

        String signed = signer.sign(up.url());
        long exp = Long.parseLong(signed.replaceAll(".*exp=(\\d+).*", "$1"));
        String sig = signed.replaceAll(".*sig=", "");
        assertThat(signer.verify(name, exp, sig)).isTrue();
        assertThat(signer.verify(name, exp, sig + "x")).isFalse();
        assertThat(signer.verify(name, Instant.now().getEpochSecond() - 1, sig)).isFalse();

        // un executable deguise en video est refuse
        byte[] exe = new byte[]{'M', 'Z', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        assertThatThrownBy(() -> storage.store(new MockMultipartFile("file", "v.mp4", "video/mp4", exe), u, false))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void revokedCertificateIsFlaggedAndNoLongerCounts() {
        Certificate c = certificates.findAll().stream().filter(x -> !x.isRevoked()).findFirst().orElseThrow();
        certAdmin.revoke(admin(), c.getCode(), "Fraude constatée");
        CertificateDto v = learning.verify(c.getCode());
        assertThat(v.revokedAt()).isNotNull();
        assertThat(v.revokedReason()).isEqualTo("Fraude constatée");
        assertThat(certificates.findValidForUser(c.getUser().getId())).noneMatch(x -> x.getCode().equals(c.getCode()));
        certAdmin.restore(c.getCode());
        assertThat(learning.verify(c.getCode()).revokedAt()).isNull();
        assertThat(certAdmin.search(c.getCode())).hasSize(1);
        assertThat(List.of(c.getCode())).isNotEmpty();
    }
}
