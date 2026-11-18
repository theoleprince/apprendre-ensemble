package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.EnrollmentService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.web.bind.annotation.*;

/** Catalogue consultable sans compte, inscription et tableau "Mes formations". */
@RestController
@RequestMapping("/api")
public class CatalogController {

    private final EnrollmentService enrollments;
    private final CurrentUser currentUser;

    public CatalogController(EnrollmentService enrollments, CurrentUser currentUser) {
        this.enrollments = enrollments;
        this.currentUser = currentUser;
    }

    @GetMapping("/public/catalog")
    public Catalog catalog() {
        return enrollments.catalog(currentUser.find().orElse(null));
    }

    @GetMapping("/public/courses/{id}")
    public CourseDetail course(@PathVariable Long id) {
        return enrollments.courseDetail(currentUser.find().orElse(null), id);
    }

    @GetMapping("/public/programs/{id}")
    public ProgramPublicDetail program(@PathVariable Long id) {
        return enrollments.programDetail(currentUser.find().orElse(null), id);
    }

    @PostMapping("/enrollments")
    public EnrollResult enroll(@Valid @RequestBody EnrollRequest req) {
        return enrollments.enroll(currentUser.get(), req);
    }

    @GetMapping("/me/learning")
    public MyLearning myLearning() {
        return enrollments.myLearning(currentUser.get());
    }
}
