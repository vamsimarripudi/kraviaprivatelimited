package com.kravia.companyos.evidence;

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
@RequestMapping("/evidence")
public class EvidenceController {
    private final EvidenceService service;

    public EvidenceController(EvidenceService service) {
        this.service = service;
    }

    @GetMapping("/packs")
    public List<EvidencePackResponse> listPacks(@AuthenticationPrincipal AppUser actor) {
        return service.listPacks(actor);
    }

    @PostMapping("/packs/generate")
    public EvidencePackResponse generate(@Valid @RequestBody EvidencePackRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.generate(request, actor);
    }

    @GetMapping("/timeline")
    public List<EvidenceTimelineItem> timeline(@AuthenticationPrincipal AppUser actor) {
        return service.timeline(actor);
    }

    @DeleteMapping("/packs/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
