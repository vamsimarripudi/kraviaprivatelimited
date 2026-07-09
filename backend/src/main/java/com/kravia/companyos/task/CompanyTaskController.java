package com.kravia.companyos.task;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/tasks")
public class CompanyTaskController {
    private final CompanyTaskService service;

    public CompanyTaskController(CompanyTaskService service) { this.service = service; }

    @PostMapping
    public CompanyTaskResponse create(@Valid @RequestBody CompanyTaskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<CompanyTaskResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) TaskCategory category,
        @RequestParam(required = false) String assignee,
        @RequestParam(required = false) TaskStatus status,
        @RequestParam(required = false) TaskPriority priority,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, category, assignee, status, priority, actor);
    }

    @GetMapping("/{id}")
    public CompanyTaskResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public CompanyTaskResponse update(@PathVariable UUID id, @Valid @RequestBody CompanyTaskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @PatchMapping("/{id}/status")
    public CompanyTaskResponse updateStatus(@PathVariable UUID id, @Valid @RequestBody TaskStatusRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateStatus(id, request, actor);
    }

    @PatchMapping("/{id}/complete")
    public CompanyTaskResponse complete(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.complete(id, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}