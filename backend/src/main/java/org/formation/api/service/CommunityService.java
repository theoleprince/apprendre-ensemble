package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.ForumPost;
import org.formation.api.domain.ForumThread;
import org.formation.api.repository.ForumPostRepository;
import org.formation.api.repository.ForumThreadRepository;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** Communautes de pratique : discussions par pays et par module, seances de visioconference animees. */
@Service
@Transactional
public class CommunityService {

    private final ForumThreadRepository threads;
    private final ForumPostRepository posts;
    private final AccessPolicy policy;

    public CommunityService(ForumThreadRepository threads, ForumPostRepository posts, AccessPolicy policy) {
        this.threads = threads;
        this.posts = posts;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public List<ThreadDto> list(AppUser user, Long courseId) {
        return threads.findVisible(user.getCountryCode()).stream()
                .filter(t -> courseId == null || courseId.equals(t.getCourseId()))
                .map(t -> toDto(t, posts.countByThreadId(t.getId())))
                .toList();
    }

    public ThreadDto create(AppUser user, ThreadInput in) {
        // Seuls les animateurs (mentors / formateurs) programment des visioconferences.
        boolean canAnimate = policy.isMentor(user);
        ForumThread t = new ForumThread();
        t.setTitle(in.title().trim());
        t.setBody(in.body());
        t.setAuthor(user);
        t.setCourseId(in.courseId());
        t.setCountryCode(user.getCountryCode());
        if (canAnimate && in.meetingUrl() != null && in.meetingUrl().startsWith("https://")) {
            t.setMeetingUrl(in.meetingUrl());
            t.setMeetingAt(in.meetingAt());
        }
        t.setPinned(canAnimate && in.meetingUrl() != null);
        return toDto(threads.save(t), 0);
    }

    @Transactional(readOnly = true)
    public List<PostDto> posts(AppUser user, Long threadId) {
        visibleThread(user, threadId);
        return posts.findForThread(threadId).stream()
                .map(p -> new PostDto(p.getId(), p.getAuthor().getFullName(), p.getAuthor().getRole(), p.getBody(), p.getCreatedAt()))
                .toList();
    }

    public PostDto reply(AppUser user, Long threadId, PostInput in) {
        ForumThread t = visibleThread(user, threadId);
        ForumPost p = new ForumPost();
        p.setThread(t);
        p.setAuthor(user);
        p.setBody(in.body().trim());
        posts.save(p);
        t.setLastActivityAt(Instant.now());
        threads.save(t);
        return new PostDto(p.getId(), user.getFullName(), user.getRole(), p.getBody(), p.getCreatedAt());
    }

    private ForumThread visibleThread(AppUser user, Long id) {
        ForumThread t = threads.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (t.getCountryCode() != null && !t.getCountryCode().equals(user.getCountryCode()) && !policy.isStaff(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return t;
    }

    private static ThreadDto toDto(ForumThread t, long replies) {
        return new ThreadDto(t.getId(), t.getTitle(), t.getBody(), t.getAuthor().getFullName(), t.getAuthor().getRole(),
                t.getCourseId(), t.getMeetingUrl(), t.getMeetingAt(), t.isPinned(), replies, t.getCreatedAt(),
                t.getLastActivityAt());
    }
}
