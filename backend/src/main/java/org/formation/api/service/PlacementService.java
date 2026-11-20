package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.PlacementQuestionRepository;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Test d'entree : quelques questions simples (avec pictogrammes) orientent chaque utilisateur vers les modules adaptes.
 * Les options pointent vers des modules par leur titre : le meme test se reutilise d'un pays a l'autre.
 */
@Service
@Transactional
public class PlacementService {

    private final PlacementQuestionRepository questions;
    private final LearningService learning;
    private final AppUserRepository users;

    public PlacementService(PlacementQuestionRepository questions, LearningService learning, AppUserRepository users) {
        this.questions = questions;
        this.learning = learning;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<PlacementQuestionDto> questionsFor(AppUser user) {
        return applicable(user).stream()
                .map(q -> new PlacementQuestionDto(q.getId(), q.getQuestion(),
                        q.getOptions().stream().map(o -> new PlacementOptionDto(o.getLabel(), o.getIcon())).toList()))
                .toList();
    }

    private List<PlacementQuestion> applicable(AppUser user) {
        return questions.findAllByOrderByPositionAsc().stream()
                .filter(q -> q.getRoles().isEmpty() || q.getRoles().contains(AccessPolicy.audienceOf(user)))
                .toList();
    }

    public PlacementResult submit(AppUser user, Map<Long, Integer> answers) {
        List<Course> visible = learning.visible(user);
        Map<String, Course> byTitle = visible.stream()
                .collect(Collectors.toMap(c -> c.getTitle().toLowerCase(Locale.ROOT), c -> c, (a, b) -> a));

        // Score de chaque module = nombre de reponses qui le recommandent
        Map<Long, Integer> score = new LinkedHashMap<>();
        for (PlacementQuestion q : applicable(user)) {
            Integer idx = answers.get(q.getId());
            if (idx == null || idx < 0 || idx >= q.getOptions().size()) continue;
            String title = q.getOptions().get(idx).getRecommendsCourseTitle();
            if (title == null) continue;
            Course c = byTitle.get(title.toLowerCase(Locale.ROOT));
            if (c != null) score.merge(c.getId(), 1, Integer::sum);
        }
        List<Long> ids = score.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .map(Map.Entry::getKey).limit(3).collect(Collectors.toCollection(ArrayList::new));
        if (ids.isEmpty() && !visible.isEmpty()) {
            ids.add(visible.getFirst().getId()); // a defaut : premier module du parcours
        }
        user.setPlacementDone(true);
        user.setRecommendedCourseIds(ids.stream().map(String::valueOf).collect(Collectors.joining(",")));
        users.save(user);

        Set<Long> rec = new HashSet<>(ids);
        List<CourseSummary> recommended = learning.visibleCourses(user).stream()
                .filter(c -> rec.contains(c.id()))
                .sorted(Comparator.comparingInt(c -> ids.indexOf(c.id())))
                .toList();
        String msg = recommended.isEmpty()
                ? "Aucun module ne correspond encore a votre profil."
                : "Nous vous conseillons de commencer par : " + recommended.getFirst().title();
        return new PlacementResult(recommended, msg);
    }
}
