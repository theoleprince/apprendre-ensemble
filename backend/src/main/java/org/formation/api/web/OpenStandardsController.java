package org.formation.api.web;

import org.formation.api.domain.CertificateLevel;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.CoursePackageService;
import org.formation.api.service.OpenBadgeService;
import org.formation.api.service.XapiService;
import org.formation.api.web.dto.Dtos.AdminCourse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Standards ouverts : certificats Open Badges 3.0 (publics, verifiables par tous),
 * traces xAPI et paquets de cours transferables (administration).
 */
@RestController
@RequestMapping("/api")
public class OpenStandardsController {

    private static final MediaType LD_JSON = MediaType.parseMediaType("application/ld+json");

    private final OpenBadgeService badges;
    private final XapiService xapi;
    private final CoursePackageService packages;
    private final CurrentUser currentUser;

    public OpenStandardsController(OpenBadgeService badges, XapiService xapi, CoursePackageService packages, CurrentUser currentUser) {
        this.badges = badges;
        this.xapi = xapi;
        this.packages = packages;
        this.currentUser = currentUser;
    }

    // ---------- Open Badges 3.0 ----------
    @GetMapping("/public/certificates/{code}/badge")
    public ResponseEntity<Map<String, Object>> badge(@PathVariable String code) {
        return ResponseEntity.ok().contentType(LD_JSON).body(badges.credential(code));
    }

    /** Version signee (VC-JWT) : c'est elle qu'on importe dans un portefeuille numerique. */
    @GetMapping("/public/certificates/{code}/badge.jwt")
    public ResponseEntity<String> signedBadge(@PathVariable String code) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/vc+jwt"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"badge-" + code + ".jwt\"")
                .body(badges.signedCredential(code));
    }

    @GetMapping("/public/issuer")
    public ResponseEntity<Map<String, Object>> issuer() {
        return ResponseEntity.ok().contentType(LD_JSON).body(badges.issuer());
    }

    @GetMapping("/public/issuer/jwks")
    public Map<String, Object> jwks() {
        return badges.jwks();
    }

    @GetMapping("/public/achievements/{courseId}/{level}")
    public ResponseEntity<Map<String, Object>> achievement(@PathVariable Long courseId, @PathVariable CertificateLevel level) {
        return ResponseEntity.ok().contentType(LD_JSON).body(badges.achievement(courseId, level));
    }

    // ---------- xAPI ----------
    @GetMapping("/admin/export/xapi-statements.json")
    public ResponseEntity<List<Map<String, Object>>> xapi() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"xapi-statements.json\"")
                .header("X-Experience-API-Version", XapiService.VERSION)
                .body(xapi.statements());
    }

    // ---------- paquets de cours ----------
    @GetMapping("/admin/courses/{id}/package.zip")
    public ResponseEntity<byte[]> exportCourse(@PathVariable Long id) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"cours-" + id + ".zip\"")
                .body(packages.export(id));
    }

    @PostMapping(value = "/admin/courses/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AdminCourse importCourse(@RequestParam("file") MultipartFile file) {
        return packages.importPackage(file, currentUser.get());
    }
}
