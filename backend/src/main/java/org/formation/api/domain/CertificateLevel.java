package org.formation.api.domain;

/** Les quatre niveaux de certification demandes, du plus simple au plus exigeant. */
public enum CertificateLevel {
    /** Attestation de participation : toutes les lecons du module suivies. */
    ATTESTATION("Attestation de participation"),
    /** Badge de micro-certification : evaluation du module reussie. */
    BADGE("Badge de micro-certification"),
    /** Certification de maitrise : toutes les lecons + score de maitrise. */
    MAITRISE("Certification de maîtrise"),
    /** Certification d'expertise : maitrise + portfolio valide par un mentor. */
    EXPERTISE("Certification d'expertise");

    private final String label;

    CertificateLevel(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
