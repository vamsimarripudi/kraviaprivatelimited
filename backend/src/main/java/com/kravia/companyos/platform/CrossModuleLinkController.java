package com.kravia.companyos.platform;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform/links")
public class CrossModuleLinkController {
    private final CrossModuleLinkService service;

    public CrossModuleLinkController(CrossModuleLinkService service) {
        this.service = service;
    }

    @GetMapping
    public List<CrossModuleLinkResponse> list(@RequestParam(required = false) String module, @RequestParam(required = false) UUID recordId, @AuthenticationPrincipal AppUser actor) {
        return service.list(module, recordId, actor);
    }

    @PostMapping
    public CrossModuleLinkResponse create(@Valid @RequestBody CrossModuleLinkRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.delete(id, actor);
    }
}
