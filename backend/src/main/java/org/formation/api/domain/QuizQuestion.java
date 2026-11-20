package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class QuizQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    /** Lecon dont cette question sert de test de comprehension (null = evaluation finale seulement). */
    @ManyToOne(fetch = FetchType.LAZY)
    private Lesson lesson;

    @Column(nullable = false, length = 1000)
    private String question;

    @ElementCollection(fetch = FetchType.EAGER)
    @OrderColumn(name = "option_index")
    @CollectionTable(name = "quiz_question_option")
    @Column(name = "option_text", length = 500)
    private List<String> options = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private QuestionKind kind = QuestionKind.SINGLE;

    /** Mise en situation affichee avant la question (type SCENARIO). */
    @Column(length = 2000)
    private String context;

    private int correctIndex;

    /** Explication affichee apres correction (evaluation formative). */
    @Column(length = 2000)
    private String explanation;
}
