package com.kravia.companyos.announcement;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.notification.NotificationService;
import com.kravia.companyos.notification.NotificationType;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnnouncementService {
    private static final String MODULE = "ANNOUNCEMENTS";

    private final AnnouncementRepository announcements;
    private final PermissionService permissions;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public AnnouncementService(AnnouncementRepository announcements, PermissionService permissions, AuditService auditService, NotificationService notificationService) {
        this.announcements = announcements;
        this.permissions = permissions;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> list(AppUser actor) {
        requireViewer(actor);
        return announcements.findAll().stream()
            .filter(announcement -> canViewAnnouncement(announcement, actor))
            .sorted(Comparator.comparing((Announcement announcement) -> announcement.getStatus() == AnnouncementStatus.PINNED ? 0 : 1).thenComparing(Announcement::getUpdatedAt, Comparator.reverseOrder()))
            .map(AnnouncementResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public AnnouncementResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        Announcement announcement = find(id);
        if (!canViewAnnouncement(announcement, actor)) throw new NotFoundException("Announcement not found.");
        return AnnouncementResponse.from(announcement);
    }

    @Transactional
    public AnnouncementResponse create(AnnouncementRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        if (request.status() == AnnouncementStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        Announcement announcement = new Announcement();
        announcement.setCreatedBy(actor.getDisplayName());
        apply(announcement, request);
        applyLifecycle(announcement);
        Announcement saved = announcements.saveAndFlush(announcement);
        auditService.record(actor, MODULE, "ANNOUNCEMENT_CREATED", "Created announcement " + saved.getTitle(), "IMPORTANT");
        if (isNotifiable(saved.getStatus())) createAnnouncementNotifications(saved, actor, "ANNOUNCEMENT_PUBLISHED");
        return AnnouncementResponse.from(saved);
    }

    @Transactional
    public AnnouncementResponse update(UUID id, AnnouncementRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        Announcement announcement = find(id);
        ensureEditable(announcement);
        AnnouncementStatus previousStatus = announcement.getStatus();
        if (request.status() == AnnouncementStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(announcement, request);
        applyLifecycle(announcement);
        Announcement saved = announcements.saveAndFlush(announcement);
        auditService.record(actor, MODULE, "ANNOUNCEMENT_UPDATED", "Updated announcement " + saved.getTitle(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        if (!isNotifiable(previousStatus) && isNotifiable(saved.getStatus())) createAnnouncementNotifications(saved, actor, "ANNOUNCEMENT_PUBLISHED");
        return AnnouncementResponse.from(saved);
    }

    @Transactional
    public AnnouncementResponse pin(UUID id, AppUser actor) {
        requireEditor(actor);
        Announcement announcement = find(id);
        ensureEditable(announcement);
        AnnouncementStatus previousStatus = announcement.getStatus();
        announcement.setStatus(AnnouncementStatus.PINNED);
        if (announcement.getPublishedAt() == null) announcement.setPublishedAt(Instant.now());
        announcement.setPinnedAt(Instant.now());
        Announcement saved = announcements.saveAndFlush(announcement);
        auditService.record(actor, MODULE, "ANNOUNCEMENT_PINNED", "Pinned announcement " + saved.getTitle(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        if (previousStatus != AnnouncementStatus.PINNED) createAnnouncementNotifications(saved, actor, "ANNOUNCEMENT_PINNED");
        return AnnouncementResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        Announcement announcement = find(id);
        AnnouncementStatus previousStatus = announcement.getStatus();
        if (announcement.getStatus() != AnnouncementStatus.ARCHIVED) {
            announcement.setStatus(AnnouncementStatus.ARCHIVED);
            announcement.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, announcement, previousStatus, announcement.getStatus());
        auditService.record(actor, MODULE, "ANNOUNCEMENT_ARCHIVED", "Archived announcement " + announcement.getTitle(), "WARNING");
    }

    private void apply(Announcement announcement, AnnouncementRequest request) {
        announcement.setTitle(request.title().trim());
        announcement.setMessage(request.message().trim());
        announcement.setAudience(request.audience());
        announcement.setStatus(request.status());
        announcement.setExpiresAt(request.expiresAt());
    }

    private void applyLifecycle(Announcement announcement) {
        if (announcement.getStatus() == AnnouncementStatus.PUBLISHED || announcement.getStatus() == AnnouncementStatus.PINNED) {
            if (announcement.getPublishedAt() == null) announcement.setPublishedAt(Instant.now());
        }
        if (announcement.getStatus() == AnnouncementStatus.PINNED && announcement.getPinnedAt() == null) announcement.setPinnedAt(Instant.now());
        if (announcement.getStatus() == AnnouncementStatus.ARCHIVED && announcement.getArchivedAt() == null) announcement.setArchivedAt(Instant.now());
    }

    private void validateRequest(AnnouncementRequest request) {
        if (request.title() == null || request.title().isBlank()) throw new IllegalArgumentException("Announcement title is required.");
        if (request.message() == null || request.message().isBlank()) throw new IllegalArgumentException("Announcement message is required.");
        if (request.audience() == null) throw new IllegalArgumentException("Announcement audience is required.");
        if (request.status() == null) throw new IllegalArgumentException("Announcement status is required.");
    }

    private void ensureEditable(Announcement announcement) {
        if (announcement.getStatus() == AnnouncementStatus.ARCHIVED) throw new ForbiddenOperationException("Archived announcements cannot be edited.");
    }

    private void createAnnouncementNotifications(Announcement announcement, AppUser actor, String eventName) {
        notificationService.createForAudience(
            announcement.getAudience(),
            NotificationType.GENERAL,
            announcement.getTitle(),
            announcement.getMessage(),
            eventName,
            announcement.getId(),
            actor
        );
    }

    private void auditStatusChange(AppUser actor, Announcement announcement, AnnouncementStatus previousStatus, AnnouncementStatus newStatus) {
        if (previousStatus != newStatus) auditService.record(actor, MODULE, "ANNOUNCEMENT_STATUS_CHANGED", "Changed announcement status from " + previousStatus + " to " + newStatus + " for " + announcement.getTitle(), "INFO");
    }

    private boolean isNotifiable(AnnouncementStatus status) { return status == AnnouncementStatus.PUBLISHED || status == AnnouncementStatus.PINNED; }

    private boolean canViewAnnouncement(Announcement announcement, AppUser actor) {
        if (actor.hasRole(Role.FOUNDER) || actor.hasRole(Role.DIRECTOR)) return true;
        if (!actor.hasRole(Role.VIEWER)) return false;
        boolean visibleStatus = announcement.getStatus() == AnnouncementStatus.PUBLISHED || announcement.getStatus() == AnnouncementStatus.PINNED;
        boolean visibleAudience = announcement.getAudience() == AnnouncementAudience.VIEWER || announcement.getAudience() == AnnouncementAudience.EVERYONE;
        return visibleStatus && visibleAudience;
    }

    private Announcement find(UUID id) {
        return announcements.findById(id).orElseThrow(() -> new NotFoundException("Announcement not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
}