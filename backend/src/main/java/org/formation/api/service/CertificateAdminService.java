package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Certificate;
import org.formation.api.domain.ProgramCertificate;
import org.formation.api.repository.CertificateRepository;
import org.formation.api.repository.ProgramCertificateRepository;
import org.formation.api.web.dto.Dtos.CertificateAdmin;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Recherche et revocation des certificats. Un certificat revoque reste verifiable publiquement (avec la mention
 * « révoqué » et le motif), n'est plus telechargeable et ne compte plus pour les certificats de formation.
 * Il n'est pas re-delivre automatiquement.
 */
@Service
@Transactional
public class CertificateAdminService {

    private final CertificateRepository certificates;
    private final ProgramCertificateRepository programCerts;

    public CertificateAdminService(CertificateRepository certificates, ProgramCertificateRepository programCerts) {
        this.certificates = certificates;
        this.programCerts = programCerts;
    }

    @Transactional(readOnly = true)
    public List<CertificateAdmin> search(String q) {
        String like = "%" + (q == null ? "" : q.trim().toLowerCase()) + "%";
        List<CertificateAdmin> out = new ArrayList<>();
        certificates.search(like, PageRequest.of(0, 50)).forEach(c -> out.add(toAdmin(c)));
        programCerts.search(like, PageRequest.of(0, 50)).forEach(c -> out.add(toAdmin(c)));
        out.sort(Comparator.comparing(CertificateAdmin::issuedAt).reversed());
        return out;
    }

    public CertificateAdmin revoke(AppUser actor, String code, String reason) {
        String k = code.trim().toUpperCase();
        var c = certificates.findByCode(k);
        if (c.isPresent()) {
            Certificate x = c.get();
            if (x.isRevoked()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Déjà révoqué");
            x.setRevokedAt(Instant.now());
            x.setRevokedReason(reason.trim());
            x.setRevokedBy(actor.getFullName());
            return toAdmin(certificates.save(x));
        }
        ProgramCertificate pc = programCerts.findByCode(k)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificat introuvable"));
        if (pc.isRevoked()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Déjà révoqué");
        pc.setRevokedAt(Instant.now());
        pc.setRevokedReason(reason.trim());
        pc.setRevokedBy(actor.getFullName());
        return toAdmin(programCerts.save(pc));
    }

    public CertificateAdmin restore(String code) {
        String k = code.trim().toUpperCase();
        var c = certificates.findByCode(k);
        if (c.isPresent()) {
            Certificate x = c.get();
            x.setRevokedAt(null);
            x.setRevokedReason(null);
            x.setRevokedBy(null);
            return toAdmin(certificates.save(x));
        }
        ProgramCertificate pc = programCerts.findByCode(k)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificat introuvable"));
        pc.setRevokedAt(null);
        pc.setRevokedReason(null);
        pc.setRevokedBy(null);
        return toAdmin(programCerts.save(pc));
    }

    private static CertificateAdmin toAdmin(Certificate c) {
        return new CertificateAdmin(c.getCode(), "COURS", c.getCourse().getTitle(), c.getLevel().label(), c.getUser().getFullName(),
                c.getUser().getId(), c.getIssuedAt(), c.getRevokedAt(), c.getRevokedReason(), c.getRevokedBy());
    }

    private static CertificateAdmin toAdmin(ProgramCertificate c) {
        return new CertificateAdmin(c.getCode(), "FORMATION", c.getProgram().getTitle(),
                c.getRank() == null ? "Certificat de formation" : "Certificat de formation · lauréat·e", c.getUser().getFullName(),
                c.getUser().getId(), c.getIssuedAt(), c.getRevokedAt(), c.getRevokedReason(), c.getRevokedBy());
    }
}
