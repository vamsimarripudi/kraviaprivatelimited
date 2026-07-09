package com.kravia.companyos.platform;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform/workflows")
public class WorkflowController {
    private final WorkflowService service;

    public WorkflowController(WorkflowService service) {
        this.service = service;
    }

    @GetMapping
    public List<WorkflowResponse> list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) WorkflowType workflowType,
        @RequestParam(required = false) WorkflowState state,
        @RequestParam(required = false) String assignee,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(q, workflowType, state, assignee, actor);
    }

    @GetMapping("/{id}")
    public WorkflowResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PostMapping
    public WorkflowResponse create(@Valid @RequestBody WorkflowRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @PatchMapping("/{id}/state")
    public WorkflowResponse updateState(@PathVariable UUID id, @Valid @RequestBody WorkflowStateRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateState(id, request, actor);
    }

    @PostMapping("/{id}/comments")
    public WorkflowResponse addComment(@PathVariable UUID id, @Valid @RequestBody WorkflowCommentRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.addComment(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
