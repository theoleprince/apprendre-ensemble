package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Paiement en ligne (sans simulation), licences institutionnelles, abonnements. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:payments;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media-payments",
        "app.ai.enabled=false",
        "app.payment.fedapay.secret-key=",
        "app.payment.fedapay.webhook-secret=wh_test_secret"})
@Transactional
class PaymentRulesTest {

    @Autowired PaymentService payments;
    @Autowired FedaPayGateway gateway;
    @Autowired EnrollmentService enrollments;
    @Autowired AppUserRepository users;
    @Autowired CourseRepository courses;
    @Autowired PaymentRepository paymentRepo;
    @Autowired SubscriptionPlanRepository plans;
    @Autowired LicenceCodeRepository licences;

    private AppUser jeune() {
        return users.findByEmailIgnoreCase("jeune@demo.local").orElseThrow();
    }

    private Course paid() {
        return courses.findAllByOrderByIdAsc().stream().filter(c -> c.getPrice() > 0).findFirst().orElseThrow();
    }

    @Test
    void withoutProviderKeyOnlinePaymentIsUnavailableNotSimulated() {
        assertThat(payments.config().enabled()).isFalse();
        assertThatThrownBy(() -> payments.start(jeune(), new PaymentStartRequest(Payment.Kind.COURSE, paid().getId())))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("non configuré");
    }

    @Test
    void webhookSignatureIsVerifiedWithTimestampTolerance() throws Exception {
        String payload = "{\"name\":\"transaction.approved\",\"entity\":{\"id\":123}}";
        long now = Instant.now().getEpochSecond();
        assertThat(gateway.verifyWebhook(payload, header(payload, now, "wh_test_secret"))).isTrue();
        assertThat(gateway.verifyWebhook(payload, header(payload, now, "autre_secret"))).isFalse();
        assertThat(gateway.verifyWebhook(payload + " ", header(payload, now, "wh_test_secret"))).isFalse();
        assertThat(gateway.verifyWebhook(payload, header(payload, now - 3600, "wh_test_secret"))).isFalse();
        assertThat(gateway.verifyWebhook(payload, null)).isFalse();
        assertThat(gateway.transactionIdFromEvent(payload)).isEqualTo("123");
        assertThatThrownBy(() -> payments.webhook(payload, "t=1,s=faux")).isInstanceOf(ResponseStatusException.class);
    }

    private static String header(String payload, long t, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "t=" + t + ",s=" + HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void confirmedPaymentGrantsAccessExactlyOnce() {
        AppUser u = jeune();
        Course c = paid();
        Payment p = new Payment();
        p.setUser(u);
        p.setKind(Payment.Kind.COURSE);
        p.setTargetId(c.getId());
        p.setAmount(c.getPrice());
        p.setReference("GDP-TEST-1");
        p.setStatus(Payment.Status.APPROVED);
        paymentRepo.save(p);
        payments.fulfill(p);
        payments.fulfill(p);
        assertThat(enrollments.isEnrolled(u, c)).isTrue();
        assertThat(p.getFulfilledAt()).isNotNull();
    }

    @Test
    void activeSubscriptionOpensPaidContent() {
        AppUser u = jeune();
        SubscriptionPlan plan = plans.findByActiveTrueOrderByPriceAsc().getFirst();
        Payment p = new Payment();
        p.setUser(u);
        p.setKind(Payment.Kind.SUBSCRIPTION);
        p.setTargetId(plan.getId());
        p.setAmount(plan.getPrice());
        p.setReference("GDP-TEST-2");
        paymentRepo.save(p);
        payments.fulfill(p);
        assertThat(payments.mySubscription(u).active()).isTrue();
        EnrollResult r = enrollments.enroll(u, new EnrollRequest(paid().getId(), null, Enrollment.Method.ABONNEMENT, null, null));
        assertThat(r.paymentRef()).isEqualTo("ABONNEMENT");
    }

    @Test
    void licenceRespectsSeatsExpiryAndScope() {
        LicenceCode l = new LicenceCode();
        l.setCode("ECOLE-1");
        l.setInstitution("École test");
        l.setSeats(1);
        licences.save(l);
        Course c = paid();
        enrollments.enroll(jeune(), new EnrollRequest(c.getId(), null, Enrollment.Method.CODE, null, "ECOLE-1"));
        AppUser other = users.findByEmailIgnoreCase("parent@demo.local").orElseThrow();
        assertThatThrownBy(() -> enrollments.enroll(other, new EnrollRequest(c.getId(), null, Enrollment.Method.CODE, null, "ECOLE-1")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("place");

        LicenceCode expired = new LicenceCode();
        expired.setCode("ECOLE-2");
        expired.setInstitution("École test");
        expired.setValidUntil(LocalDate.now().minusDays(1));
        licences.save(expired);
        assertThatThrownBy(() -> enrollments.enroll(other, new EnrollRequest(c.getId(), null, Enrollment.Method.CODE, null, "ECOLE-2")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("expiré");
    }
}
