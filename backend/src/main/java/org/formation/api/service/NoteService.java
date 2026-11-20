package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Lesson;
import org.formation.api.domain.LessonNote;
import org.formation.api.repository.LessonNoteRepository;
import org.formation.api.repository.LessonRepository;
import org.formation.api.web.dto.Dtos.NoteDto;
import org.formation.api.web.dto.Dtos.NoteInput;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** Notes personnelles et signets sur les lecons (privees : visibles par leur auteur seulement). */
@Service
@Transactional
public class NoteService {

    private final LessonNoteRepository notes;
    private final LessonRepository lessons;
    private final EnrollmentService enrollments;

    public NoteService(LessonNoteRepository notes, LessonRepository lessons, EnrollmentService enrollments) {
        this.notes = notes;
        this.lessons = lessons;
        this.enrollments = enrollments;
    }

    @Transactional(readOnly = true)
    public List<NoteDto> forCourse(AppUser u, Long courseId) {
        return notes.forCourse(u.getId(), courseId).stream().map(NoteService::dto).toList();
    }

    @Transactional(readOnly = true)
    public List<NoteDto> all(AppUser u) {
        return notes.forUser(u.getId()).stream().map(NoteService::dto).toList();
    }

    /** Une note vide et sans signet est supprimee. */
    public NoteDto save(AppUser u, Long lessonId, NoteInput in) {
        Lesson l = lessons.findById(lessonId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leçon introuvable"));
        if (!enrollments.isEnrolled(u, l.getCourse())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Inscrivez-vous à ce cours pour prendre des notes");
        }
        String text = in.text() == null ? "" : in.text().strip();
        LessonNote n = notes.findByUserIdAndLessonId(u.getId(), lessonId).orElse(null);
        if (text.isEmpty() && !in.bookmarked()) {
            if (n != null) notes.delete(n);
            return new NoteDto(l.getId(), l.getTitle(), l.getPosition(), l.getCourse().getId(), l.getCourse().getTitle(), "", false, Instant.now());
        }
        if (n == null) {
            n = new LessonNote();
            n.setUser(u);
            n.setLesson(l);
        }
        n.setText(text);
        n.setBookmarked(in.bookmarked());
        n.setUpdatedAt(Instant.now());
        return dto(notes.save(n));
    }

    private static NoteDto dto(LessonNote n) {
        Lesson l = n.getLesson();
        return new NoteDto(l.getId(), l.getTitle(), l.getPosition(), l.getCourse().getId(), l.getCourse().getTitle(),
                n.getText() == null ? "" : n.getText(), n.isBookmarked(), n.getUpdatedAt());
    }
}
