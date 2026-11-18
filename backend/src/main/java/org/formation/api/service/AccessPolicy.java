package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Course;
import org.formation.api.domain.Role;
import org.springframework.stereotype.Component;

/**
 * Regle unique de visibilite d'un module : public cible, pays, langue, zone geographique et groupe RCT.
 * Tout est parametrable dans le module : ajouter un pays / une langue / un public ne demande aucun developpement.
 */
@Component
public class AccessPolicy {

    public boolean isStaff(AppUser u) {
        return u.getRole() == Role.ADMIN || u.getRole() == Role.FORMATEUR;
    }

    public boolean isMentor(AppUser u) {
        return isStaff(u) || u.getRole() == Role.CONSEILLER_PEDAGOGIQUE;
    }

    public boolean canAccess(AppUser u, Course c) {
        if (isStaff(u)) {
            return true;
        }
        // le public cible est une recommandation (catalogue ouvert) ; zone, pays, langue et groupe RCT restent des droits
        return c.isPublished()
                && (c.getCountryCode() == null || c.getCountryCode().equals(u.getCountryCode()))
                && (c.getAllowedRegions().isEmpty() || c.getAllowedRegions().contains(u.getRegion()))
                && (c.getAllowedCohorts().isEmpty() || c.getAllowedCohorts().contains(u.getCohort()));
    }
}
