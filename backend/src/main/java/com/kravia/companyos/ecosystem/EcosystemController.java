package com.kravia.companyos.ecosystem;

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
@RequestMapping("/ecosystem")
public class EcosystemController {
    private final EcosystemService service;

    public EcosystemController(EcosystemService service) { this.service = service; }

    @GetMapping("/summary")
    public EcosystemSummaryResponse summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @PostMapping("/products")
    public EcosystemProductResponse create(@Valid @RequestBody EcosystemProductRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping("/products")
    public List<EcosystemProductResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) EcosystemProductStatus status,
        @RequestParam(required = false) String owner,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, status, owner, actor);
    }

    @GetMapping("/products/{id}")
    public EcosystemProductResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/products/{id}")
    public EcosystemProductResponse update(@PathVariable UUID id, @Valid @RequestBody EcosystemProductRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/products/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
