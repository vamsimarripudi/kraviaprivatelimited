package com.kravia.companyos.compliance;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/compliance-items")
public class ComplianceItemController {
    private final ComplianceItemService service;

    public ComplianceItemController(ComplianceItemService service) { this.service = service; }

    @PostMapping
    public ComplianceItemResponse create(@Valid @RequestBody ComplianceItemRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<ComplianceItemResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) ComplianceCategory category,
        @RequestParam(required = false) ComplianceStatus status,
        @RequestParam(required = false) CompliancePriority priority,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, category, status, priority, actor);
    }

    @GetMapping("/{id}")
    public ComplianceItemResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public ComplianceItemResponse update(@PathVariable UUID id, @Valid @RequestBody ComplianceItemRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
