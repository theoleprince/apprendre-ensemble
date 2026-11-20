package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.EngagementService;
import org.formation.api.service.EnrollmentService;
import org.formation.api.service.NoteService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Motivation (serie, objectif, badges), notes de lecon et chiffres publics de la plateforme. */
@RestController
@RequestMapping("/api")
public class EngagementController {

    private final EngagementService engagement;
    private final NoteService notes;
    private final EnrollmentService enrollments;
    private final CurrentUser currentUser;

    public EngagementController(EngagementService engagement, NoteService notes, EnrollmentService enrollments, CurrentUser currentUser) {
        this.engagement = engagement;
        this.notes = notes;
        this.enrollments = enrollments;
        this.currentUser = currentUser;
    }

    @GetMapping("/public/stats")
    public PublicStats stats() {
        return enrollments.publicStats();
    }

    @GetMapping("/me/engagement")
    public Engagement engagement() {
        return engagement.engagement(currentUser.get());
    }

    @PutMapping("/me/goals")
    public Engagement goals(@Valid @RequestBody GoalsInput in) {
        return engagement.saveGoals(currentUser.get(), in);
    }

    @GetMapping("/me/notes")
    public List<NoteDto> notes(@RequestParam(required = false) Long courseId) {
        return courseId == null ? notes.all(currentUser.get()) : notes.forCourse(currentUser.get(), courseId);
    }

    @PutMapping("/me/notes/{lessonId}")
    public NoteDto saveNote(@PathVariable Long lessonId, @Valid @RequestBody NoteInput in) {
        return notes.save(currentUser.get(), lessonId, in);
    }
}
