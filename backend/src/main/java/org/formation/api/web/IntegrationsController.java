package org.formation.api.web;

import org.formation.api.ai.AiClientProvider;
import org.formation.api.service.FedaPayGateway;
import org.formation.api.service.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Etat des services externes (aucun secret renvoye : seulement "configure ou non" et l'action a mener).
 * Permet de savoir, avant une demonstration ou une mise en service, ce qui fonctionne reellement.
 */
@RestController
@RequestMapping("/api/admin")
public class IntegrationsController {

    public record Integration(String key, String label, boolean configured, String mode, String howTo) {
    }

    private final AiClientProvider ai;
    private final FedaPayGateway fedapay;
    private final MailService mail;
    private final String ssoIssuer;
    private final String relayCentral;

    public IntegrationsController(AiClientProvider ai, FedaPayGateway fedapay, MailService mail,
                                  @Value("${app.sso.issuer-uri:}") String ssoIssuer,
                                  @Value("${app.relay.central-url:}") String relayCentral) {
        this.ai = ai;
        this.fedapay = fedapay;
        this.mail = mail;
        this.ssoIssuer = ssoIssuer;
        this.relayCentral = relayCentral;
    }

    @GetMapping("/integrations")
    public List<Integration> integrations() {
        boolean aiOn = ai.client().isPresent();
        return List.of(
                new Integration("ai", "Assistant et suggestions IA", aiOn, aiOn ? ai.model() : "repli local (recherche dans les cours)",
                        "Variable ANTHROPIC_API_KEY"),
                new Integration("payment", "Paiement en ligne (FedaPay)", fedapay.configured(),
                        fedapay.configured() ? fedapay.environment() : "désactivé (licences et gratuit seulement)",
                        "Variables FEDAPAY_SECRET_KEY, FEDAPAY_ENV, FEDAPAY_WEBHOOK_SECRET ; webhook /api/public/payments/fedapay/webhook"),
                new Integration("mail", "Envoi d'e-mails (mot de passe, rappels)", mail.enabled(),
                        mail.enabled() ? "SMTP" : "désactivé (liens de réinitialisation remis par l'administration)",
                        "Variables SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM"),
                new Integration("sso", "Connexion institutionnelle (SSO)", !ssoIssuer.isBlank(),
                        ssoIssuer.isBlank() ? "désactivé" : "OpenID Connect", "Variables SSO_ISSUER_URI, SSO_CLIENT_ID, SSO_CLIENT_SECRET"),
                new Integration("relay", "Mode serveur relais", !relayCentral.isBlank(),
                        relayCentral.isBlank() ? "serveur central" : "relais de " + relayCentral, "Variable APP_RELAY_CENTRAL_URL (sur le relais)"));
    }
}
