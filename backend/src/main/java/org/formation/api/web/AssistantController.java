package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.ai.AssistantService;
import org.formation.api.domain.AppUser;
import org.formation.api.security.CurrentUser;
import org.formation.api.web.dto.Dtos.ChatRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Assistant IA en streaming (Server-Sent Events) : la reponse s'affiche au fil de l'eau, meme sur reseau lent. */
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private final AssistantService assistant;
    private final CurrentUser currentUser;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AssistantController(AssistantService assistant, CurrentUser currentUser) {
        this.assistant = assistant;
        this.currentUser = currentUser;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody ChatRequest req) {
        AppUser user = currentUser.get();
        AssistantService.Context ctx = assistant.prepare(user, req);
        SseEmitter emitter = new SseEmitter(120_000L);
        executor.submit(() -> {
            try {
                assistant.chat(user, req, ctx, new AssistantService.Sink() {
                    @Override
                    public void delta(String text) {
                        send(emitter, "delta", Map.of("t", text));
                    }

                    @Override
                    public void done(boolean flagged, String mode) {
                        send(emitter, "done", Map.of("flagged", flagged, "mode", mode));
                    }
                });
                emitter.complete();
            } catch (RuntimeException e) {
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    private static void send(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            throw new IllegalStateException("Client deconnecte", e);
        }
    }
}
