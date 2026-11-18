package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.domain.Role;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.ConfigAdminService;
import org.formation.api.service.ProgramService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Parametrage : domaines, programmes, etablissements, classes, ressources (ADMIN / FORMATEUR). */
@RestController
@RequestMapping("/api/admin")
public class ConfigAdminController {

    private final ConfigAdminService config;
    private final ProgramService programs;
    private final CurrentUser currentUser;

    public ConfigAdminController(ConfigAdminService config, ProgramService programs, CurrentUser currentUser) {
        this.config = config;
        this.programs = programs;
        this.currentUser = currentUser;
    }

    // ---- Domaines
    @GetMapping("/domains")
    public List<DomainDto> domains() { return config.domains(); }

    @PostMapping("/domains")
    @ResponseStatus(HttpStatus.CREATED)
    public DomainDto createDomain(@Valid @RequestBody DomainInput in) { return config.saveDomain(null, in); }

    @PutMapping("/domains/{id}")
    public DomainDto updateDomain(@PathVariable Long id, @Valid @RequestBody DomainInput in) { return config.saveDomain(id, in); }

    @DeleteMapping("/domains/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDomain(@PathVariable Long id) { config.deleteDomain(id); }

    // ---- Programmes
    @GetMapping("/programs")
    public List<ProgramAdmin> programs() { return config.programs(); }

    @GetMapping("/programs/{id}")
    public ProgramAdmin program(@PathVariable Long id) { return config.program(id); }

    @PostMapping("/programs")
    @ResponseStatus(HttpStatus.CREATED)
    public ProgramAdmin createProgram(@Valid @RequestBody ProgramInput in) { return config.saveProgram(null, in); }

    @PutMapping("/programs/{id}")
    public ProgramAdmin updateProgram(@PathVariable Long id, @Valid @RequestBody ProgramInput in) { return config.saveProgram(id, in); }

    @DeleteMapping("/programs/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProgram(@PathVariable Long id) { config.deleteProgram(id); }

    // ---- Etablissements
    @GetMapping("/schools")
    public List<SchoolDto> schools() { return config.schools(); }

    @PostMapping("/schools")
    @ResponseStatus(HttpStatus.CREATED)
    public SchoolDto createSchool(@Valid @RequestBody SchoolInput in) { return config.saveSchool(null, in); }

    @PutMapping("/schools/{id}")
    public SchoolDto updateSchool(@PathVariable Long id, @Valid @RequestBody SchoolInput in) { return config.saveSchool(id, in); }

    // ---- Classes
    @GetMapping("/classrooms")
    public List<ClassroomAdmin> classrooms() { return config.classrooms(); }

    @GetMapping("/classrooms/{id}")
    public ClassroomAdmin classroom(@PathVariable Long id) { return config.classroom(id); }

    @PostMapping("/classrooms")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomAdmin createClassroom(@Valid @RequestBody ClassroomInput in) { return config.saveClassroom(null, in); }

    @PutMapping("/classrooms/{id}")
    public ClassroomAdmin updateClassroom(@PathVariable Long id, @Valid @RequestBody ClassroomInput in) { return config.saveClassroom(id, in); }

    @PostMapping("/classrooms/{id}/members")
    public ClassroomAdmin addMembers(@PathVariable Long id, @RequestBody MembersRequest in) { return config.addMembers(id, in); }

    @DeleteMapping("/classrooms/{id}/members/{userId}")
    public ClassroomAdmin removeMember(@PathVariable Long id, @PathVariable Long userId) { return config.removeMember(id, userId); }

    @PostMapping("/classrooms/{id}/close")
    public ClassroomAdmin close(@PathVariable Long id) { return config.close(id); }

    @GetMapping("/classrooms/{id}/leaderboard")
    public Leaderboard leaderboard(@PathVariable Long id) { return programs.leaderboard(currentUser.get(), id); }

    // ---- Ressources
    @GetMapping("/resources")
    public List<ResourceDto> resources() { return config.resources(); }

    @PostMapping("/resources")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceDto createResource(@Valid @RequestBody ResourceInput in) { return config.saveResource(null, in); }

    @PutMapping("/resources/{id}")
    public ResourceDto updateResource(@PathVariable Long id, @Valid @RequestBody ResourceInput in) { return config.saveResource(id, in); }

    @DeleteMapping("/resources/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResource(@PathVariable Long id) { config.deleteResource(id); }

    // ---- Utilisateurs
    @GetMapping("/users")
    public List<UserBrief> users(@RequestParam(required = false) Role role) { return config.users(role); }
}
