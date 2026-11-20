package org.formation.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envoi d'e-mails transactionnels (SMTP configure par SPRING_MAIL_HOST...). Sans serveur SMTP configure,
 * aucun e-mail n'est envoye : l'administration peut alors generer un lien de reinitialisation a remettre en main propre.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private final ObjectProvider<JavaMailSender> sender;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> sender, @Value("${app.mail.from:no-reply@formation.local}") String from) {
        this.sender = sender;
        this.from = from;
    }

    public boolean enabled() {
        return sender.getIfAvailable() != null;
    }

    /** @return true si l'e-mail a ete remis au serveur SMTP. */
    public boolean send(String to, String subject, String body) {
        JavaMailSender s = sender.getIfAvailable();
        if (s == null) {
            log.warn("E-mail non envoyé (aucun serveur SMTP configuré) : {}", subject);
            return false;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            s.send(m);
            return true;
        } catch (Exception e) {
            log.error("Échec d'envoi d'e-mail : {}", e.getMessage());
            return false;
        }
    }
}
