package com.kravia.companyos.risk;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/risks")
public class RiskRegisterController {
    private final RiskRegisterService service;

    public RiskRegisterController(RiskRegisterService service) {
        this.service = service;
    }

    @GetMapping
    public List<RiskResponse> list(@RequestParam(required = false) String q, @RequestParam(required = false) RiskCategory category, @RequestParam(required = false) RiskLevel severity, @RequestParam(required = false) RiskStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.list(q, category, severity, status, actor);
    }

    @PostMapping
    public RiskResponse create(@Valid @RequestBody RiskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @PutMapping("/{id}")
    public RiskResponse update(@PathVariable UUID id, @Valid @RequestBody RiskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
