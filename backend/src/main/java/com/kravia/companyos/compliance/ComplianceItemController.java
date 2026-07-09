package com.kravia.companyos.compliance;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/compliance-items")
public class ComplianceItemController {
    private final ComplianceItemService service;

    public ComplianceItemController(ComplianceItemService service) { this.service = service; }

    @GetMapping
    public List<ComplianceItemResponse> list() { return service.list(); }

    @GetMapping("/{id}")
    public ComplianceItemResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ComplianceItemResponse create(@Valid @RequestBody ComplianceItemRequest request, @AuthenticationPrincipal AppUser actor) { return service.save(request, actor); }

    @PutMapping("/{id}")
    public ComplianceItemResponse update(@PathVariable UUID id, @Valid @RequestBody ComplianceItemRequest request, @AuthenticationPrincipal AppUser actor) { return service.update(id, request, actor); }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) { service.archive(id, actor); }
}
