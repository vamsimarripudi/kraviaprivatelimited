package com.kravia.companyos.approval;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/approvals")
public class ApprovalController {
    private final ApprovalService service;

    public ApprovalController(ApprovalService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApprovalResponse> list(@RequestParam(required = false) String q, @RequestParam(required = false) ApprovalStatus status, @RequestParam(required = false) String linkedModule, @AuthenticationPrincipal AppUser actor) {
        return service.list(q, status, linkedModule, actor);
    }

    @PostMapping
    public ApprovalResponse create(@Valid @RequestBody ApprovalRequestDto request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @PutMapping("/{id}")
    public ApprovalResponse update(@PathVariable UUID id, @Valid @RequestBody ApprovalRequestDto request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @PatchMapping("/{id}/decision")
    public ApprovalResponse decide(@PathVariable UUID id, @Valid @RequestBody ApprovalDecisionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.decide(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
