package org.formation.api.service;

import org.formation.api.domain.Course;
import org.formation.api.domain.FaqEntry;
import org.formation.api.domain.Program;
import org.formation.api.web.dto.Dtos.FaqDto;
import org.formation.api.web.dto.Dtos.Presentation;

import java.util.List;
import java.util.Objects;

/** Lecture et ecriture des elements de presentation publique (niveau, objectifs, formateur, FAQ). */
public final class Presentations {

    private Presentations() {
    }

    public static Presentation of(Course c) {
        return new Presentation(c.getLevel(), List.copyOf(c.getObjectives()), c.getPrerequisites(),
                c.getAuthorName(), c.getAuthorTitle(), c.getAuthorBio(), faq(c.getFaq()));
    }

    public static Presentation of(Program p) {
        return new Presentation(p.getLevel(), List.copyOf(p.getObjectives()), p.getPrerequisites(),
                p.getAuthorName(), p.getAuthorTitle(), p.getAuthorBio(), faq(p.getFaq()));
    }

    public static void apply(Course c, Presentation in) {
        if (in == null) return;
        c.setLevel(in.level() == null ? "DEBUTANT" : in.level());
        c.getObjectives().clear();
        c.getObjectives().addAll(clean(in.objectives()));
        c.setPrerequisites(blank(in.prerequisites()));
        c.setAuthorName(blank(in.authorName()));
        c.setAuthorTitle(blank(in.authorTitle()));
        c.setAuthorBio(blank(in.authorBio()));
        c.getFaq().clear();
        c.getFaq().addAll(entries(in.faq()));
    }

    public static void apply(Program p, Presentation in) {
        if (in == null) return;
        p.setLevel(in.level() == null ? "DEBUTANT" : in.level());
        p.getObjectives().clear();
        p.getObjectives().addAll(clean(in.objectives()));
        p.setPrerequisites(blank(in.prerequisites()));
        p.setAuthorName(blank(in.authorName()));
        p.setAuthorTitle(blank(in.authorTitle()));
        p.setAuthorBio(blank(in.authorBio()));
        p.getFaq().clear();
        p.getFaq().addAll(entries(in.faq()));
    }

    private static List<FaqDto> faq(List<FaqEntry> l) {
        return l.stream().map(f -> new FaqDto(f.getQuestion(), f.getAnswer())).toList();
    }

    private static List<FaqEntry> entries(List<FaqDto> l) {
        if (l == null) return List.of();
        return l.stream().filter(f -> f != null && blank(f.question()) != null && blank(f.answer()) != null)
                .map(f -> new FaqEntry(f.question().trim(), f.answer().trim())).toList();
    }

    private static List<String> clean(List<String> l) {
        if (l == null) return List.of();
        return l.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
