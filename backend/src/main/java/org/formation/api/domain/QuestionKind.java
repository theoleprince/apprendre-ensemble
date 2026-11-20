package org.formation.api.domain;

/**
 * Types d'exercices.
 * SINGLE, TRUE_FALSE, FILL_BLANK, SCENARIO : une seule bonne reponse (correctIndex).
 * ORDER : options enregistrees dans le bon ordre, a remettre dans l'ordre.
 * MATCH : options "gauche::droite", a associer.
 */
public enum QuestionKind {
    SINGLE, TRUE_FALSE, FILL_BLANK, SCENARIO, ORDER, MATCH;

    public boolean arrangement() {
        return this == ORDER || this == MATCH;
    }
}
