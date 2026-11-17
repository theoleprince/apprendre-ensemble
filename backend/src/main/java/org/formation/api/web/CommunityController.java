package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.CommunityService;
import org.formation.api.service.PortfolioService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CommunityController {

    private final CommunityService community;
    private final PortfolioService portfolio;
    private final CurrentUser currentUser;

    public CommunityController(CommunityService community, PortfolioService portfolio, CurrentUser currentUser) {
        this.community = community;
        this.portfolio = portfolio;
        this.currentUser = currentUser;
    }

    @GetMapping("/community/threads")
    public List<ThreadDto> threads(@RequestParam(required = false) Long courseId) {
        return community.list(currentUser.get(), courseId);
    }

    @PostMapping("/community/threads")
    public ThreadDto create(@Valid @RequestBody ThreadInput in) {
        return community.create(currentUser.get(), in);
    }

    @GetMapping("/community/threads/{id}/posts")
    public List<PostDto> posts(@PathVariable Long id) {
        return community.posts(currentUser.get(), id);
    }

    @PostMapping("/community/threads/{id}/posts")
    public PostDto reply(@PathVariable Long id, @Valid @RequestBody PostInput in) {
        return community.reply(currentUser.get(), id, in);
    }

    // ---------- Mentorat ----------
    @GetMapping("/mentor/portfolios")
    public List<PortfolioDto> toReview() {
        return portfolio.toReview(currentUser.get());
    }

    @PutMapping("/mentor/portfolios/{id}")
    public PortfolioDto review(@PathVariable Long id, @Valid @RequestBody PortfolioReview in) {
        return portfolio.review(currentUser.get(), id, in);
    }
}
