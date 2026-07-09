package com.kravia.companyos.announcement;

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
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/announcements")
public class AnnouncementController {
    private final AnnouncementService service;

    public AnnouncementController(AnnouncementService service) { this.service = service; }

    @PostMapping
    public AnnouncementResponse create(@Valid @RequestBody AnnouncementRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<AnnouncementResponse> list(@AuthenticationPrincipal AppUser actor) {
        return service.list(actor);
    }

    @GetMapping("/{id}")
    public AnnouncementResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public AnnouncementResponse update(@PathVariable UUID id, @Valid @RequestBody AnnouncementRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @PatchMapping("/{id}/pin")
    public AnnouncementResponse pin(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.pin(id, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}