package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.PaymentService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class PaymentController {

    private final PaymentService payments;
    private final CurrentUser currentUser;

    public PaymentController(PaymentService payments, CurrentUser currentUser) {
        this.payments = payments;
        this.currentUser = currentUser;
    }

    @GetMapping("/public/payments/config")
    public PaymentConfig config() {
        return payments.config();
    }

    @GetMapping("/public/subscription-plans")
    public List<PlanDto> plans() {
        return payments.activePlans();
    }

    @PostMapping("/payments")
    public PaymentStart start(@Valid @RequestBody PaymentStartRequest req) {
        return payments.start(currentUser.get(), req);
    }

    @GetMapping("/payments/{reference}")
    public PaymentDto verify(@PathVariable String reference) {
        return payments.verify(currentUser.get(), reference);
    }

    @GetMapping("/me/payments")
    public List<PaymentDto> myPayments() {
        return payments.myPayments(currentUser.get());
    }

    @GetMapping("/me/subscription")
    public MySubscription mySubscription() {
        return payments.mySubscription(currentUser.get());
    }

    /** Notification du prestataire (FedaPay) : corps brut + signature X-FEDAPAY-SIGNATURE. */
    @PostMapping("/public/payments/fedapay/webhook")
    @ResponseStatus(HttpStatus.OK)
    public void webhook(@RequestBody String payload, @RequestHeader(value = "X-FEDAPAY-SIGNATURE", required = false) String signature) {
        payments.webhook(payload, signature);
    }

    // ---------- Administration ----------
    @GetMapping("/admin/subscription-plans")
    public List<PlanDto> allPlans() {
        return payments.allPlans();
    }

    @PostMapping("/admin/subscription-plans")
    public PlanDto createPlan(@Valid @RequestBody PlanInput in) {
        return payments.savePlan(null, in);
    }

    @PutMapping("/admin/subscription-plans/{id}")
    public PlanDto updatePlan(@PathVariable Long id, @Valid @RequestBody PlanInput in) {
        return payments.savePlan(id, in);
    }

    @GetMapping("/admin/licences")
    public List<LicenceDto> licences() {
        return payments.licences();
    }

    @PostMapping("/admin/licences")
    public LicenceDto createLicence(@Valid @RequestBody LicenceInput in) {
        return payments.saveLicence(null, in);
    }

    @PutMapping("/admin/licences/{id}")
    public LicenceDto updateLicence(@PathVariable Long id, @Valid @RequestBody LicenceInput in) {
        return payments.saveLicence(id, in);
    }
}
