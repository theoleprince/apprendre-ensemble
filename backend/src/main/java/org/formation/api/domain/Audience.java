package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Public cible parametrable (ex. ENSEIGNANT, PARENT, INFIRMIER). Le code sert au ciblage des contenus. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Audience {
    @Id
    @Column(length = 40)
    private String code;

    @Column(nullable = false)
    private String label;

    private String icon;

    private int position;

    /** Role de permission attribue a l'inscription (un role apprenant). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role baseRole = Role.APPRENANT;

    /** Proposé a l'inscription. */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean selfRegistration = true;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;
}
