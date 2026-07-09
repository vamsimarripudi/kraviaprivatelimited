package com.kravia.companyos.notification;

import com.kravia.companyos.user.AppUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) { this.service = service; }

    @GetMapping
    public List<NotificationResponse> list(@AuthenticationPrincipal AppUser actor) {
        return service.list(actor);
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.markRead(id, actor);
    }

    @PatchMapping("/read-all")
    public void markAllRead(@AuthenticationPrincipal AppUser actor) {
        service.markAllRead(actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}