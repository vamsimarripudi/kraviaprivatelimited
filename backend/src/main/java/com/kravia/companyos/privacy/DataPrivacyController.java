package com.kravia.companyos.privacy;

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
@RequestMapping("/privacy/records")
public class DataPrivacyController {
    private final DataPrivacyService service;

    public DataPrivacyController(DataPrivacyService service) {
        this.service = service;
    }

    @GetMapping
    public List<DataPrivacyResponse> list(@RequestParam(required = false) String moduleName, @RequestParam(required = false) DataClassification classification, @AuthenticationPrincipal AppUser actor) {
        return service.list(moduleName, classification, actor);
    }

    @PostMapping
    public DataPrivacyResponse create(@Valid @RequestBody DataPrivacyRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @PutMapping("/{id}")
    public DataPrivacyResponse update(@PathVariable UUID id, @Valid @RequestBody DataPrivacyRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @PatchMapping("/{id}/export-request")
    public DataPrivacyResponse requestExport(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.requestExport(id, actor);
    }

    @PatchMapping("/{id}/deletion-request")
    public DataPrivacyResponse requestDeletion(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.requestDeletion(id, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
