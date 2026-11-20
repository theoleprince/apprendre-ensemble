package org.formation.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Question frequente affichee sur la page de presentation d'un cours ou d'une formation. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FaqEntry {
    @Column(name = "question", length = 500)
    private String question;

    @Column(name = "answer", length = 2000)
    private String answer;
}
