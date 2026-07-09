package com.kravia.companyos.ai;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ai")
public class AiAssistantController {
    private final AiAssistantService service;

    public AiAssistantController(AiAssistantService service) { this.service = service; }

    @PostMapping("/query")
    public AiQueryResponse query(@Valid @RequestBody AiQueryRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.query(request, actor);
    }

    @GetMapping("/history")
    public List<AiQueryResponse> history(@AuthenticationPrincipal AppUser actor) {
        return service.history(actor);
    }

    @GetMapping("/history/{id}")
    public AiQueryResponse historyItem(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.historyItem(id, actor);
    }

    @DeleteMapping("/history/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
