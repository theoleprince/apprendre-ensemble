package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Paiements en ligne, abonnements et licences.
 * Regle de securite : les droits ne sont accordes qu'apres lecture, cote serveur, de l'etat de la transaction chez
 * le prestataire (statut « approved » et montant attendu). Le retour navigateur et le webhook ne font que declencher
 * cette verification ; elle est idempotente.
 */
@Service
@Transactional
public class PaymentService {

    private final PaymentRepository payments;
    private final CourseRepository courses;
    private final ProgramRepository programs;
    private final SubscriptionPlanRepository plans;
    private final SubscriptionRepository subscriptions;
    private final LicenceCodeRepository licences;
    private final EnrollmentRepository enrollments;
    private final EnrollmentService enrollmentService;
    private final AccessPolicy policy;
    private final FedaPayGateway gateway;
    private final String publicUrl;

    public PaymentService(PaymentRepository payments, CourseRepository courses, ProgramRepository programs,
                          SubscriptionPlanRepository plans, SubscriptionRepository subscriptions, LicenceCodeRepository licences,
                          EnrollmentRepository enrollments, EnrollmentService enrollmentService, AccessPolicy policy,
                          FedaPayGateway gateway, @Value("${app.public-url}") String publicUrl) {
        this.payments = payments;
        this.courses = courses;
        this.programs = programs;
        this.plans = plans;
        this.subscriptions = subscriptions;
        this.licences = licences;
        this.enrollments = enrollments;
        this.enrollmentService = enrollmentService;
        this.policy = policy;
        this.gateway = gateway;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    @Transactional(readOnly = true)
    public PaymentConfig config() {
        return new PaymentConfig(gateway.configured(), gateway.configured() ? gateway.environment() : null);
    }

    /** Ouvre un paiement et renvoie l'URL de la page de paiement securisee du prestataire. */
    public PaymentStart start(AppUser u, PaymentStartRequest req) {
        Payment p = new Payment();
        p.setUser(u);
        p.setKind(req.kind());
        p.setTargetId(req.targetId());
        p.setReference("GDP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase());
        switch (req.kind()) {
            case COURSE -> {
                Course c = courses.findById(req.targetId()).filter(x -> policy.canAccess(u, x))
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
                if (enrollments.existsByUserIdAndCourseId(u.getId(), c.getId())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Déjà inscrit·e");
                p.setAmount(c.getPrice());
                p.setDescription("Cours : " + c.getTitle());
            }
            case PROGRAM -> {
                Program pr = programs.findById(req.targetId()).filter(Program::isPublished)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable"));
                if (enrollments.findByUserIdAndProgramIdAndCourseIsNull(u.getId(), pr.getId()).isPresent()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Déjà inscrit·e");
                }
                p.setAmount(pr.getPrice());
                p.setDescription("Formation : " + pr.getTitle());
            }
            case SUBSCRIPTION -> {
                SubscriptionPlan plan = plans.findById(req.targetId()).filter(SubscriptionPlan::isActive)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Formule introuvable"));
                p.setAmount(plan.getPrice());
                p.setDescription("Abonnement : " + plan.getName());
            }
        }
        if (p.getAmount() <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce contenu est gratuit : inscrivez-vous directement");
        payments.save(p);
        FedaPayGateway.Checkout co = gateway.createCheckout(p, u, publicUrl + "/paiement/retour?ref=" + p.getReference());
        p.setProviderTransactionId(co.transactionId());
        p.setUpdatedAt(Instant.now());
        payments.save(p);
        return new PaymentStart(p.getReference(), co.url());
    }

    /** Verification au retour sur le site : etat relu chez le prestataire. */
    public PaymentDto verify(AppUser u, String reference) {
        Payment p = payments.findByReference(reference).filter(x -> x.getUser().getId().equals(u.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paiement introuvable"));
        refresh(p);
        return toDto(p);
    }

    /** Webhook du prestataire : signature verifiee, puis meme verification que ci-dessus. */
    public void webhook(String payload, String signature) {
        if (!gateway.verifyWebhook(payload, signature)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature invalide");
        }
        String txId = gateway.transactionIdFromEvent(payload);
        if (txId == null) return;
        payments.findByProviderTransactionId(txId).ifPresent(this::refresh);
    }

    void refresh(Payment p) {
        if (p.getStatus() != Payment.Status.PENDING || p.getProviderTransactionId() == null) return;
        FedaPayGateway.TxState st = gateway.fetch(p.getProviderTransactionId());
        switch (st.status() == null ? "" : st.status()) {
            case "approved", "transferred" -> {
                if (st.amount() != p.getAmount()) {
                    p.setStatus(Payment.Status.FAILED);
                } else {
                    p.setStatus(Payment.Status.APPROVED);
                    fulfill(p);
                }
            }
            case "declined" -> p.setStatus(Payment.Status.DECLINED);
            case "canceled", "refunded" -> p.setStatus(Payment.Status.CANCELED);
            default -> { /* pending : rien a faire */ }
        }
        p.setUpdatedAt(Instant.now());
        payments.save(p);
    }

    /** Attribution des droits, une seule fois. */
    void fulfill(Payment p) {
        if (p.getFulfilledAt() != null) return;
        AppUser u = p.getUser();
        Enrollment.Method m = Enrollment.Method.MOBILE_MONEY;
        switch (p.getKind()) {
            case COURSE -> courses.findById(p.getTargetId()).ifPresent(c -> enrollmentService.grantCourse(u, c, m, p.getAmount(), p.getReference()));
            case PROGRAM -> programs.findById(p.getTargetId()).ifPresent(pr -> enrollmentService.grantProgram(u, pr, m, p.getAmount(), p.getReference()));
            case SUBSCRIPTION -> plans.findById(p.getTargetId()).ifPresent(plan -> {
                // prolongation si un abonnement est encore actif
                Instant start = subscriptions.findByUserIdOrderByEndsAtDesc(u.getId()).stream()
                        .filter(Subscription::isActive).map(Subscription::getEndsAt).findFirst().orElse(Instant.now());
                Subscription s = new Subscription();
                s.setUser(u);
                s.setPlan(plan);
                s.setStartsAt(start);
                s.setEndsAt(start.plus(Duration.ofDays(plan.getDurationDays())));
                s.setPaymentReference(p.getReference());
                subscriptions.save(s);
            });
        }
        p.setFulfilledAt(Instant.now());
    }

    // ---------- Abonnements ----------
    @Transactional(readOnly = true)
    public List<PlanDto> activePlans() {
        return plans.findByActiveTrueOrderByPriceAsc().stream().map(PaymentService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public MySubscription mySubscription(AppUser u) {
        return subscriptions.findByUserIdOrderByEndsAtDesc(u.getId()).stream().filter(Subscription::isActive).findFirst()
                .map(s -> new MySubscription(true, s.getPlan().getName(), s.getEndsAt()))
                .orElse(new MySubscription(false, null, null));
    }

    @Transactional(readOnly = true)
    public List<PaymentDto> myPayments(AppUser u) {
        return payments.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().map(PaymentService::toDto).toList();
    }

    // ---------- Administration : formules et licences ----------
    @Transactional(readOnly = true)
    public List<PlanDto> allPlans() {
        return plans.findAll().stream().map(PaymentService::toDto).toList();
    }

    public PlanDto savePlan(Long id, PlanInput in) {
        SubscriptionPlan p = id == null ? new SubscriptionPlan() : plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        p.setName(in.name().trim());
        p.setDescription(in.description());
        p.setPrice(in.price());
        p.setDurationDays(in.durationDays());
        p.setActive(in.active());
        return toDto(plans.save(p));
    }

    @Transactional(readOnly = true)
    public List<LicenceDto> licences() {
        return licences.findAllByOrderByCreatedAtDesc().stream().map(PaymentService::toDto).toList();
    }

    public LicenceDto saveLicence(Long id, LicenceInput in) {
        LicenceCode l = id == null ? new LicenceCode() : licences.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String code = in.code().trim().toUpperCase();
        licences.findByCodeIgnoreCase(code).filter(x -> !x.getId().equals(l.getId())).ifPresent(x -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce code existe déjà");
        });
        l.setCode(code);
        l.setInstitution(in.institution().trim());
        l.setSeats(Math.max(0, in.seats()));
        l.setValidUntil(in.validUntil());
        l.setProgramId(in.programId());
        l.setActive(in.active());
        return toDto(licences.save(l));
    }

    // ---------- DTO ----------
    static PaymentDto toDto(Payment p) {
        return new PaymentDto(p.getReference(), p.getKind(), p.getTargetId(), p.getDescription(), p.getAmount(), p.getCurrency(),
                p.getStatus(), p.getCreatedAt(), p.getFulfilledAt() != null);
    }

    static PlanDto toDto(SubscriptionPlan p) {
        return new PlanDto(p.getId(), p.getName(), p.getDescription(), p.getPrice(), p.getDurationDays(), p.isActive());
    }

    static LicenceDto toDto(LicenceCode l) {
        return new LicenceDto(l.getId(), l.getCode(), l.getInstitution(), l.getSeats(), l.getUsed(), l.getValidUntil(), l.getProgramId(), l.isActive());
    }
}
