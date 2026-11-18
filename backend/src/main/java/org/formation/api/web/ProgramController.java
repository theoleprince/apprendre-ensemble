package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.ConfigAdminService;
import org.formation.api.service.ProgramService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Programmes, classes, classement, ressources et suivi des equipes (cote apprenant / mentor / direction). */
@RestController
@RequestMapping("/api")
public class ProgramController {

    private final ProgramService programs;
    private final ConfigAdminService config;
    private final CurrentUser currentUser;

    public ProgramController(ProgramService programs, ConfigAdminService config, CurrentUser currentUser) {
        this.programs = programs;
        this.config = config;
        this.currentUser = currentUser;
    }

    @GetMapping("/me/programs")
    public List<ProgramSummary> myPrograms() {
        return programs.myPrograms(currentUser.get());
    }

    @GetMapping("/programs/{id}")
    public ProgramDetail program(@PathVariable Long id) {
        return programs.program(currentUser.get(), id);
    }

    @GetMapping("/me/classrooms")
    public List<ClassroomBrief> myClassrooms() {
        return programs.myClassrooms(currentUser.get());
    }

    @PostMapping("/classrooms/join")
    public ClassroomBrief join(@Valid @RequestBody JoinRequest req) {
        return programs.join(currentUser.get(), req.code());
    }

    @GetMapping("/classrooms/{id}/leaderboard")
    public Leaderboard leaderboard(@PathVariable Long id) {
        return programs.leaderboard(currentUser.get(), id);
    }

    @GetMapping("/me/program-certificates")
    public List<ProgramCertDto> programCertificates() {
        return programs.myProgramCertificates(currentUser.get());
    }

    @GetMapping("/resources")
    public List<ResourceDto> resources() {
        return config.resourcesFor(currentUser.get());
    }

    @GetMapping("/domains")
    public List<DomainDto> domains() {
        return config.domains();
    }

    @GetMapping("/school/dashboard")
    public SchoolDashboard school() {
        return programs.schoolDashboard(currentUser.get());
    }

    @GetMapping("/mentor/dashboard")
    public MentorDashboard mentor() {
        return programs.mentorDashboard(currentUser.get());
    }
}
