package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.report.ReportService;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.LearningService;
import org.formation.api.service.PlacementService;
import org.formation.api.service.PortfolioService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class LearningController {

    private final LearningService learning;
    private final PlacementService placement;
    private final PortfolioService portfolio;
    private final ReportService reports;
    private final CurrentUser currentUser;

    public LearningController(LearningService learning, PlacementService placement, PortfolioService portfolio,
                              ReportService reports, CurrentUser currentUser) {
        this.learning = learning;
        this.placement = placement;
        this.portfolio = portfolio;
        this.reports = reports;
        this.currentUser = currentUser;
    }

    // ---------- Test d'entree ----------
    @GetMapping("/placement")
    public List<PlacementQuestionDto> placementQuestions() {
        return placement.questionsFor(currentUser.get());
    }

    @PostMapping("/placement")
    public PlacementResult placementSubmit(@Valid @RequestBody PlacementSubmission req) {
        return placement.submit(currentUser.get(), req.answers());
    }

    // ---------- Modules ----------
    @GetMapping("/courses")
    public List<CourseSummary> courses() {
        return learning.visibleCourses(currentUser.get());
    }

    /** Paquet complet (lecons + quiz sans reponses) a stocker sur l'appareil pour usage hors ligne. */
    @GetMapping("/courses/{id}/package")
    public CoursePackage coursePackage(@PathVariable Long id) {
        return learning.coursePackage(currentUser.get(), id);
    }

    @GetMapping("/progress")
    public List<ProgressItem> progress() {
        return learning.serverProgress(currentUser.get());
    }

    /** Envoi en lot de la progression accumulee hors ligne. Idempotent : peut etre rejoue sans risque. */
    @PostMapping("/sync/progress")
    public SyncResponse sync(@Valid @RequestBody SyncRequest req) {
        return learning.sync(currentUser.get(), req.items());
    }

    @PostMapping("/courses/{id}/quiz")
    public QuizResult quiz(@PathVariable Long id, @Valid @RequestBody QuizSubmission req) {
        return learning.submitQuiz(currentUser.get(), id, req.answers());
    }

    @GetMapping("/courses/{id}/feedback")
    public ResponseEntity<FeedbackInput> myFeedback(@PathVariable Long id) {
        return learning.myFeedback(currentUser.get(), id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/courses/{id}/feedback")
    public void feedback(@PathVariable Long id, @Valid @RequestBody FeedbackInput in) {
        learning.saveFeedback(currentUser.get(), id, in);
    }

    // ---------- Portfolio ----------
    @GetMapping("/portfolio")
    public List<PortfolioDto> myPortfolio() {
        return portfolio.mine(currentUser.get());
    }

    @PostMapping("/portfolio")
    public PortfolioDto submitPortfolio(@Valid @RequestBody PortfolioInput in) {
        return portfolio.submit(currentUser.get(), in);
    }

    // ---------- Certificats ----------
    @GetMapping("/certificates")
    public List<CertificateDto> certificates() {
        return learning.myCertificates(currentUser.get());
    }

    @GetMapping("/me/transcript.pdf")
    public ResponseEntity<byte[]> transcript() {
        return Pdf.inline("releve-de-formation.pdf", reports.transcriptPdf(currentUser.get()));
    }

    /** Verification publique d'un certificat (lien ajoute au profil LinkedIn, QR code). */
    @GetMapping("/public/certificates/{code}")
    public CertificateDto verify(@PathVariable String code) {
        return learning.verify(code);
    }

    @GetMapping("/public/certificates/{code}/pdf")
    public ResponseEntity<byte[]> certificatePdf(@PathVariable String code) {
        return Pdf.inline("certificat-" + code + ".pdf", reports.certificatePdf(code));
    }
}
