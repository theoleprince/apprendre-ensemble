package org.formation.api.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.formation.api.domain.Role;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.AccountService;
import org.formation.api.service.CertificateAdminService;
import org.formation.api.service.PasswordResetService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Mot de passe oublie, donnees personnelles (export, effacement), administration des comptes et des certificats. */
@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService accounts;
    private final PasswordResetService resets;
    private final CertificateAdminService certs;
    private final CurrentUser currentUser;

    public AccountController(AccountService accounts, PasswordResetService resets, CertificateAdminService certs, CurrentUser currentUser) {
        this.accounts = accounts;
        this.resets = resets;
        this.certs = certs;
        this.currentUser = currentUser;
    }

    // ---------- Mot de passe oublie (public) ----------
    @PostMapping("/auth/forgot")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> forgot(@Valid @RequestBody ForgotRequest req, HttpServletRequest http) {
        resets.request(req.email(), http.getRemoteAddr());
        return Map.of("message", "Si un compte correspond à cette adresse, un e-mail vient d'être envoyé.");
    }

    @PostMapping("/auth/reset")
    public Map<String, String> reset(@Valid @RequestBody ResetRequest req) {
        resets.reset(req.token(), req.password());
        return Map.of("message", "Mot de passe modifié. Vous pouvez vous connecter.");
    }

    // ---------- Self-service ----------
    @PostMapping("/me/logout-everywhere")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutEverywhere() {
        accounts.logoutEverywhere(currentUser.get());
    }

    @GetMapping("/me/export")
    public ResponseEntity<Map<String, Object>> export() {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=\"mes-donnees.json\"")
                .body(accounts.export(currentUser.get()));
    }

    @PostMapping("/me/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@Valid @RequestBody PasswordConfirm req) {
        accounts.eraseSelf(currentUser.get(), req.password());
    }

    // ---------- Administration des comptes ----------
    @GetMapping("/admin/accounts")
    public UserPage list(@RequestParam(required = false) String q, @RequestParam(required = false) Role role,
                         @RequestParam(required = false) Boolean enabled,
                         @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return accounts.list(q, role, enabled, page, size);
    }

    @PostMapping("/admin/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUser create(@Valid @RequestBody AdminUserInput in) {
        return accounts.create(currentUser.get(), in);
    }

    @PutMapping("/admin/accounts/{id}")
    public AdminUser update(@PathVariable Long id, @Valid @RequestBody AdminUserInput in) {
        return accounts.update(currentUser.get(), id, in);
    }

    @PostMapping("/admin/accounts/{id}/disable")
    public AdminUser disable(@PathVariable Long id) {
        return accounts.setEnabled(currentUser.get(), id, false);
    }

    @PostMapping("/admin/accounts/{id}/enable")
    public AdminUser enable(@PathVariable Long id) {
        return accounts.setEnabled(currentUser.get(), id, true);
    }

    @PostMapping("/admin/accounts/{id}/reset-link")
    public ResetLinkDto resetLink(@PathVariable Long id) {
        return accounts.resetLink(currentUser.get(), id);
    }

    @DeleteMapping("/admin/accounts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void erase(@PathVariable Long id) {
        accounts.eraseByAdmin(currentUser.get(), id);
    }

    // ---------- Certificats ----------
    @GetMapping("/admin/certificates")
    public List<CertificateAdmin> certificates(@RequestParam(required = false) String q) {
        return certs.search(q);
    }

    @PostMapping("/admin/certificates/{code}/revoke")
    public CertificateAdmin revoke(@PathVariable String code, @Valid @RequestBody RevokeRequest req) {
        return certs.revoke(currentUser.get(), code, req.reason());
    }

    @PostMapping("/admin/certificates/{code}/restore")
    public CertificateAdmin restore(@PathVariable String code) {
        return certs.restore(code);
    }
}
