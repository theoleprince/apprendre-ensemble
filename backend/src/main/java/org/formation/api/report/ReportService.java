package org.formation.api.report;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import net.sf.jasperreports.engine.*;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import net.sf.jasperreports.export.SimpleExporterInput;
import net.sf.jasperreports.export.SimpleOutputStreamExporterOutput;
import net.sf.jasperreports.pdf.SimplePdfExporterConfiguration;
import net.sf.jasperreports.pdf.SimplePdfReportConfiguration;
import net.sf.jasperreports.pdf.JRPdfExporter;
import org.formation.api.domain.*;
import org.formation.api.repository.CertificateRepository;
import org.formation.api.repository.ProgramCertificateRepository;
import org.formation.api.repository.QuizAttemptRepository;
import org.formation.api.service.AnalyticsService;
import org.formation.api.service.LearningService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Etats PDF generes avec JasperReports (gabarits JRXML dans resources/reports, editables dans Jaspersoft Studio) :
 * certificat (4 niveaux, QR code de verification), releve de formation individuel, rapport de suivi du programme.
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.of("Africa/Porto-Novo"));
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("Africa/Porto-Novo"));

    private final Map<String, JasperReport> compiled = new ConcurrentHashMap<>();
    private final CertificateRepository certificates;
    private final ProgramCertificateRepository programCerts;
    private final QuizAttemptRepository attempts;
    private final LearningService learning;
    private final AnalyticsService analytics;
    private final String platformName;
    private final String publicUrl;
    private final String signatory1;
    private final String signatory1Role;
    private final String signatory2;
    private final String signatory2Role;

    public ReportService(CertificateRepository certificates, ProgramCertificateRepository programCerts, QuizAttemptRepository attempts, LearningService learning, AnalyticsService analytics,
                         @Value("${app.brand.name:Plateforme de formation}") String platformName,
                         @Value("${app.public-url:http://localhost:4200}") String publicUrl,
                         @Value("${app.brand.signatory1:Responsable pedagogique}") String signatory1,
                         @Value("${app.brand.signatory1-role:Coordination pedagogique}") String signatory1Role,
                         @Value("${app.brand.signatory2:Direction du programme}") String signatory2,
                         @Value("${app.brand.signatory2-role:En partenariat avec le ministere de l'education}") String signatory2Role) {
        this.certificates = certificates;
        this.programCerts = programCerts;
        this.attempts = attempts;
        this.learning = learning;
        this.analytics = analytics;
        this.platformName = platformName;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
        this.signatory1 = signatory1;
        this.signatory1Role = signatory1Role;
        this.signatory2 = signatory2;
        this.signatory2Role = signatory2Role;
    }

    /** Compile les gabarits au demarrage (en arriere-plan) : le premier PDF est servi sans attente. */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void warmUp() {
        Thread.ofVirtual().start(() -> List.of("certificate", "transcript", "impact-report").forEach(this::report));
    }

    // ---------- Certificat ----------

    public byte[] certificatePdf(String code) {
        String k = code.trim().toUpperCase();
        Optional<Certificate> found = certificates.findByCode(k);
        if (found.isEmpty()) {
            return programCerts.findByCode(k).map(this::programCertificatePdf)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificat introuvable"));
        }
        Certificate c = found.get();
        String verifyUrl = publicUrl + "/verifier/" + c.getCode();
        Map<String, Object> p = new HashMap<>();
        p.put("PLATFORM_NAME", platformName);
        p.put("LEVEL_LABEL", c.getLevel().label());
        p.put("LEVEL_SHORT", switch (c.getLevel()) {
            case ATTESTATION -> "PARTICIPATION";
            case BADGE -> "BADGE";
            case MAITRISE -> "MAÎTRISE";
            case EXPERTISE -> "EXPERTISE";
        });
        p.put("LEVEL_TEXT", switch (c.getLevel()) {
            case ATTESTATION -> "pour avoir suivi l'ensemble des leçons du module";
            case BADGE -> "pour avoir réussi l'évaluation du module";
            case MAITRISE -> "pour avoir démontré la maîtrise des compétences du module";
            case EXPERTISE -> "pour avoir démontré son expertise en situation réelle, validée sur portfolio par un mentor";
        });
        p.put("LEARNER_NAME", c.getUser().getFullName());
        p.put("COURSE_TITLE", c.getCourse().getTitle());
        p.put("DETAILS", (c.getLevel() == CertificateLevel.ATTESTATION ? "" : "Score obtenu : " + c.getScorePercent() + " %  ·  ")
                + "Délivré le " + DATE.format(c.getIssuedAt()));
        p.put("CODE", c.getCode());
        p.put("VERIFY_URL", verifyUrl);
        p.put("YEAR", String.valueOf(c.getIssuedAt().atZone(ZoneId.of("UTC")).getYear()));
        p.put("SIGNATORY_1", signatory1);
        p.put("SIGNATORY_1_ROLE", signatory1Role);
        p.put("SIGNATORY_2", signatory2);
        p.put("SIGNATORY_2_ROLE", signatory2Role);
        p.put("QR", qr(verifyUrl));
        return pdf("certificate", p, new JREmptyDataSource(1), "Certificat " + c.getCode());
    }

    /** Certificat de parcours (programme complet), avec mention de laureat·e pour le podium de la classe. */
    private byte[] programCertificatePdf(ProgramCertificate pc) {
        String verifyUrl = publicUrl + "/verifier/" + pc.getCode();
        Map<String, Object> p = new HashMap<>();
        p.put("PLATFORM_NAME", platformName);
        boolean laureate = pc.getRank() != null;
        p.put("LEVEL_LABEL", laureate ? "Certificat de parcours · Lauréat·e" : "Certificat de parcours");
        p.put("LEVEL_SHORT", laureate ? (pc.getRank() + (pc.getRank() == 1 ? "ER" : "E") + " / " + pc.getClassSize()) : "PARCOURS");
        p.put("LEVEL_TEXT", laureate
                ? "pour avoir terminé le parcours et s'être classé·e " + pc.getRank() + (pc.getRank() == 1 ? "er" : "e") + " de sa classe"
                : "pour avoir suivi avec succès l'ensemble du parcours de formation");
        p.put("LEARNER_NAME", pc.getUser().getFullName());
        p.put("COURSE_TITLE", pc.getProgram().getTitle());
        p.put("DETAILS", (pc.getClassroom() == null ? "" : pc.getClassroom().getName() + "  ·  ")
                + (pc.getPoints() > 0 ? pc.getPoints() + " points  ·  " : "") + "Délivré le " + DATE.format(pc.getIssuedAt()));
        p.put("CODE", pc.getCode());
        p.put("VERIFY_URL", verifyUrl);
        p.put("YEAR", String.valueOf(pc.getIssuedAt().atZone(ZoneId.of("UTC")).getYear()));
        p.put("SIGNATORY_1", signatory1);
        p.put("SIGNATORY_1_ROLE", signatory1Role);
        p.put("SIGNATORY_2", signatory2);
        p.put("SIGNATORY_2_ROLE", signatory2Role);
        p.put("QR", qr(verifyUrl));
        return pdf("certificate", p, new JREmptyDataSource(1), "Certificat " + pc.getCode());
    }

    // ---------- Releve individuel ----------

    public byte[] transcriptPdf(AppUser user) {
        List<CourseSummary> list = learning.visibleCourses(user);
        Map<Long, Integer> best = new HashMap<>();
        for (CourseSummary c : list) {
            attempts.findTopByUserIdAndCourseIdOrderByScorePercentDesc(user.getId(), c.id())
                    .ifPresent(a -> best.put(c.id(), a.getScorePercent()));
        }
        List<Map<String, ?>> rows = new ArrayList<>();
        int done = 0;
        int lessons = 0;
        for (CourseSummary c : list) {
            if (c.completedLessons() == 0 && c.levels().isEmpty()) continue;
            double ratio = c.lessonCount() == 0 ? 0 : c.completedLessons() / (double) c.lessonCount();
            Map<String, Object> r = new HashMap<>();
            r.put("course", c.title());
            r.put("type", (c.type() == CourseType.PRATIQUE ? "Parcours pratique" : "Parcours théorique") + " · " + c.totalMinutes() + " min");
            r.put("progress", c.completedLessons() + " / " + c.lessonCount() + " leçons (" + Math.round(ratio * 100) + " %)");
            r.put("ratio", ratio);
            r.put("score", best.containsKey(c.id()) ? best.get(c.id()) + " %" : "—");
            r.put("levels", c.levels().isEmpty() ? "—" : c.levels().stream().map(CertificateLevel::label).collect(Collectors.joining("\n")));
            rows.add(r);
            lessons += c.completedLessons();
            if (ratio >= 0.999) done++;
        }
        long certs = list.stream().mapToLong(c -> c.levels().size()).sum();
        Map<String, Object> p = new HashMap<>();
        p.put("PLATFORM_NAME", platformName);
        p.put("LEARNER_NAME", user.getFullName());
        p.put("PROFILE", roleLabel(user.getRole()) + " · " + Objects.requireNonNullElse(user.getCountryCode(), "")
                + (user.getRegion() == null ? "" : " · " + user.getRegion()));
        p.put("GENERATED_AT", DATETIME.format(java.time.Instant.now()));
        p.put("SUMMARY", done + " module(s) terminé(s) · " + lessons + " leçon(s) · " + certs + " certification(s)");
        return pdf("transcript", p, new JRMapCollectionDataSource(rows), "Releve " + user.getFullName());
    }

    // ---------- Rapport de suivi ----------

    public byte[] impactPdf(AnalyticsService.Filter f) {
        Dashboard d = analytics.dashboard(f);
        List<Map<String, ?>> rows = d.courses().stream().<Map<String, ?>>map(c -> {
            Map<String, Object> r = new HashMap<>();
            r.put("title", c.title());
            r.put("started", String.valueOf(c.started()));
            r.put("completed", String.valueOf(c.completed()));
            r.put("rate", pct(c.completionRate()));
            r.put("score", c.avgScore() == 0 ? "—" : Math.round(c.avgScore()) + " %");
            r.put("time", c.completed() == 0 ? "—" : Math.round(c.avgMinutes()) + " / " + Math.round(c.medianMinutes()) + " min");
            r.put("dropouts", String.valueOf(c.dropouts()));
            r.put("offline", pct(c.offlineShare()));
            r.put("rating", c.feedbackCount() == 0 ? "—" : String.format(Locale.FRANCE, "%.1f", c.avgRating()));
            return r;
        }).toList();
        Map<String, Object> p = new HashMap<>();
        p.put("PLATFORM_NAME", platformName);
        List<String> scope = new ArrayList<>();
        if (f.country() != null && !f.country().isBlank()) scope.add("pays " + f.country());
        if (f.region() != null && !f.region().isBlank()) scope.add("zone " + f.region());
        if (f.cohort() != null && !f.cohort().isBlank()) scope.add("groupe " + f.cohort());
        p.put("SCOPE", scope.isEmpty() ? "ensemble du programme" : String.join(", ", scope));
        p.put("GENERATED_AT", DATETIME.format(java.time.Instant.now()));
        p.put("K_LEARNERS", String.valueOf(d.learners()));
        p.put("K_ACTIVE", String.valueOf(d.active7d()));
        p.put("K_LESSONS", String.valueOf(d.lessonsCompleted()));
        p.put("K_OFFLINE", pct(d.offlineShare()));
        p.put("K_CERTS", String.valueOf(d.certificates()));
        p.put("K_RATING", d.avgRating() == 0 ? "—" : String.format(Locale.FRANCE, "%.1f", d.avgRating()));
        p.put("CERTS_BY_LEVEL", d.certificatesByLevel().isEmpty() ? "aucune"
                : d.certificatesByLevel().stream().map(x -> x.label() + " " + x.count()).collect(Collectors.joining(" · ")));
        return pdf("impact-report", p, new JRMapCollectionDataSource(rows), "Rapport de suivi");
    }

    // ---------- Outils ----------

    private byte[] pdf(String template, Map<String, Object> params, JRDataSource ds, String title) {
        try {
            JasperPrint print = JasperFillManager.fillReport(report(template), params, ds);
            JRPdfExporter exporter = new JRPdfExporter();
            exporter.setExporterInput(new SimpleExporterInput(print));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            exporter.setExporterOutput(new SimpleOutputStreamExporterOutput(out));
            SimplePdfExporterConfiguration conf = new SimplePdfExporterConfiguration();
            conf.setMetadataTitle(title);
            conf.setMetadataAuthor(platformName);
            conf.setMetadataCreator(platformName);
            exporter.setConfiguration(conf);
            SimplePdfReportConfiguration rc = new SimplePdfReportConfiguration();
            rc.setForceLineBreakPolicy(false);
            exporter.setConfiguration(rc);
            exporter.exportReport();
            return out.toByteArray();
        } catch (JRException e) {
            throw new IllegalStateException("Generation PDF impossible (" + template + ")", e);
        }
    }

    private JasperReport report(String name) {
        return compiled.computeIfAbsent(name, n -> {
            try (InputStream in = getClass().getResourceAsStream("/reports/" + n + ".jrxml")) {
                return JasperCompileManager.compileReport(in);
            } catch (Exception e) {
                throw new IllegalStateException("Gabarit " + n + " invalide", e);
            }
        });
    }

    private static BufferedImage qr(String text) {
        try {
            BitMatrix m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 360, 360,
                    Map.of(EncodeHintType.MARGIN, 1, EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M));
            return MatrixToImageWriter.toBufferedImage(m);
        } catch (WriterException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String pct(double ratio) {
        return Math.round(ratio * 100) + " %";
    }

    static String roleLabel(Role r) {
        return switch (r) {
            case ADMIN -> "Administration";
            case FORMATEUR -> "Formateur·trice";
            case ENSEIGNANT -> "Enseignant·e";
            case CONSEILLER_PEDAGOGIQUE -> "Conseiller·ère pédagogique";
            case DIRECTION_ECOLE -> "Direction d'école";
            case PARENT -> "Parent / éducateur·trice";
            case TRAVAILLEUR_SOCIAL -> "Travailleur·se social·e";
            case JEUNE -> "Jeune";
        };
    }
}
