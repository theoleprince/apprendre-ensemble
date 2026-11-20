package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Question du test d'entree. Chaque option oriente vers zero, un ou plusieurs modules. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class PlacementQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int position;

    @Column(nullable = false, length = 1000)
    private String question;

    /** Publics concernes (vide = tous). */
    @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "placement_question_role")
    @Column(name = "role")
    private Set<String> roles = new HashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @OrderColumn(name = "option_index")
    @CollectionTable(name = "placement_option")
    private List<PlacementOption> options = new ArrayList<>();
}
