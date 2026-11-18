package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Classroom;
import org.formation.api.domain.Course;
import org.formation.api.repository.ClassroomRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/** Ouverture progressive des modules d'une classe (calendrier) et etat des classes. */
@Component
@Transactional(readOnly = true)
public class ClassroomLocks {

    private final ClassroomRepository classrooms;

    public ClassroomLocks(ClassroomRepository classrooms) {
        this.classrooms = classrooms;
    }

    public static String status(Classroom c, LocalDate today) {
        if (c.isClosed() || today.isAfter(c.getEndDate())) return "CLOSED";
        if (today.isBefore(c.getStartDate())) return "UPCOMING";
        return "ACTIVE";
    }

    public static int week(Classroom c, LocalDate today) {
        if (today.isBefore(c.getStartDate())) return 0;
        long days = ChronoUnit.DAYS.between(c.getStartDate(), today.isAfter(c.getEndDate()) ? c.getEndDate() : today);
        return (int) Math.min(totalWeeks(c), days / 7 + 1);
    }

    public static int totalWeeks(Classroom c) {
        return (int) Math.max(1, (ChronoUnit.DAYS.between(c.getStartDate(), c.getEndDate()) + 7) / 7);
    }

    /** Date d'ouverture du module en position index (0 = premier) dans la classe. */
    public static LocalDate unlockDate(Classroom c, int index) {
        return c.getUnlockMode() == Classroom.UnlockMode.ALL ? c.getStartDate()
                : c.getStartDate().plusDays((long) index * c.getUnlockIntervalDays());
    }

    /** Si l'apprenant suit une classe (en cours ou a venir) contenant ce module encore ferme : date d'ouverture. */
    public Optional<LocalDate> lockedUntil(AppUser user, Course course) {
        LocalDate today = LocalDate.now();
        for (Classroom c : classrooms.findForMember(user.getId())) {
            if ("CLOSED".equals(status(c, today))) continue;
            int idx = indexOf(c, course);
            if (idx < 0) continue;
            LocalDate d = unlockDate(c, idx);
            if (d.isAfter(today)) return Optional.of(d);
        }
        return Optional.empty();
    }

    static int indexOf(Classroom c, Course course) {
        for (int i = 0; i < c.getProgram().getCourses().size(); i++) {
            if (c.getProgram().getCourses().get(i).getId().equals(course.getId())) return i;
        }
        return -1;
    }
}
