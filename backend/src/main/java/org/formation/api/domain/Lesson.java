package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Lesson {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    private int position;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    private MediaType mediaType = MediaType.TEXT;

    /** URL du media (fichier televerse /api/media/... ou URL externe). */
    @Column(length = 1000)
    private String mediaUrl;

    /** Taille du media : affichee avant telechargement (donnees mobiles couteuses). */
    private long mediaSizeBytes;

    /** Sous-titres WebVTT pour la video. */
    @Column(length = 1000)
    private String subtitlesUrl;

    /** Contenu texte (lecon texte) ou transcription (audio / video). */
    @Column(columnDefinition = "TEXT")
    private String content;

    /** Mise en situation pratique : consigne a documenter dans le portfolio. */
    @Column(length = 2000)
    private String practiceTask;

    private int durationMinutes;
}
