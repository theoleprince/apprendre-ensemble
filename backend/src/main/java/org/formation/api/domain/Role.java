package org.formation.api.domain;

/**
 * Roles = PERMISSIONS (fixes). Les PUBLICS cibles (enseignants, parents, infirmiers...) sont des donnees
 * parametrables (entite Audience) : un nouveau public s'ajoute sans developpement et s'appuie sur un role de base.
 */
public enum Role {
    ADMIN,
    FORMATEUR,
    ENSEIGNANT,
    CONSEILLER_PEDAGOGIQUE,
    DIRECTION_ECOLE,
    PARENT,
    TRAVAILLEUR_SOCIAL,
    JEUNE,
    /** Apprenant d'un public ajoute par parametrage. */
    APPRENANT
}
