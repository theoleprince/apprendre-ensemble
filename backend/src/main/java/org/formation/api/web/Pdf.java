package org.formation.api.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

final class Pdf {
    private Pdf() {
    }

    static ResponseEntity<byte[]> inline(String filename, byte[] body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename.replaceAll("[^A-Za-z0-9._-]", "_") + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(body);
    }
}
