package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.ai.ImprovementService;
import org.formation.api.domain.AssistantLog;
import org.formation.api.report.ReportService;
import org.formation.api.repository.AssistantLogRepository;
import org.formation.api.service.AdminService;
import org.formation.api.service.AnalyticsService;
import org.formation.api.service.ExportService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;
    private final AnalyticsService analytics;
    private final ExportService exports;
    private final ImprovementService improvement;
    private final ReportService reports;
    private final AssistantLogRepository assistantLogs;

    public AdminController(AdminService admin, AnalyticsService analytics, ExportService exports,
                           ImprovementService improvement, ReportService reports, AssistantLogRepository assistantLogs) {
        this.admin = admin;
        this.analytics = analytics;
        this.exports = exports;
        this.improvement = improvement;
        this.reports = reports;
        this.assistantLogs = assistantLogs;
    }

    // ---------- Tableau de bord ----------
    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam(required = false) String country, @RequestParam(required = false) String region,
                               @RequestParam(required = false) String cohort) {
        return analytics.dashboard(new AnalyticsService.Filter(country, region, cohort));
    }

    @GetMapping("/report.pdf")
    public ResponseEntity<byte[]> report(@RequestParam(required = false) String country, @RequestParam(required = false) String region,
                                         @RequestParam(required = false) String cohort) {
        return Pdf.inline("rapport-de-suivi-" + LocalDate.now() + ".pdf",
                reports.impactPdf(new AnalyticsService.Filter(country, region, cohort)));
    }

    // ---------- Boucle d'amelioration ----------
    @GetMapping("/courses/{id}/insights")
    public CourseInsights insights(@PathVariable Long id) {
        return analytics.insights(id);
    }

    @PostMapping("/courses/{id}/ai-suggestions")
    public AiSuggestions suggestions(@PathVariable Long id) {
        return improvement.suggest(id);
    }

    // ---------- Exports ouverts ----------
    @GetMapping("/export/{dataset}.{format}")
    public ResponseEntity<byte[]> export(@PathVariable String dataset, @PathVariable String format) {
        if (!ExportService.DATASETS.contains(dataset)) {
            return ResponseEntity.notFound().build();
        }
        String body;
        MediaType type;
        switch (format) {
            case "csv" -> {
                body = "﻿" + exports.csv(dataset); // BOM : ouverture correcte dans Excel
                type = new MediaType("text", "csv", StandardCharsets.UTF_8);
            }
            case "json" -> {
                body = exports.json(dataset);
                type = MediaType.APPLICATION_JSON;
            }
            default -> {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + dataset + "-" + LocalDate.now() + "." + format + "\"")
                .contentType(type)
                .body(body.getBytes(StandardCharsets.UTF_8));
    }

    // ---------- Modules ----------
    @GetMapping("/courses")
    public List<AdminCourse> courses() {
        return admin.listCourses();
    }

    @GetMapping("/courses/{id}")
    public CourseInput course(@PathVariable Long id) {
        return admin.getCourse(id);
    }

    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminCourse create(@Valid @RequestBody CourseInput in) {
        return admin.create(in);
    }

    @PutMapping("/courses/{id}")
    public AdminCourse update(@PathVariable Long id, @Valid @RequestBody CourseInput in) {
        return admin.update(id, in);
    }

    @DeleteMapping("/courses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        admin.delete(id);
    }

    // ---------- Apprenants et groupes RCT ----------
    @GetMapping("/learners")
    public List<LearnerRow> learners() {
        return admin.learners();
    }

    @PutMapping("/learners/cohort")
    public Map<String, Integer> assign(@Valid @RequestBody CohortAssign in) {
        return Map.of("updated", admin.assign(in));
    }

    @PostMapping("/learners/randomize")
    public RandomizeResult randomize(@Valid @RequestBody RandomizeRequest in) {
        return admin.randomize(in);
    }

    // ---------- Supervision de l'IA ----------
    @GetMapping("/assistant/logs")
    public List<AssistantLog> assistantLogs(@RequestParam(defaultValue = "false") boolean flaggedOnly) {
        return flaggedOnly ? assistantLogs.findByFlaggedTrueOrderByAtDesc() : assistantLogs.findTop50ByOrderByAtDesc();
    }
}
