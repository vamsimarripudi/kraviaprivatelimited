package com.kravia.companyos.notification;

import com.kravia.companyos.announcement.AnnouncementAudience;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
    private static final String MODULE = "NOTIFICATIONS";

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final PermissionService permissions;
    private final AuditService auditService;

    public NotificationService(NotificationRepository notifications, UserRepository users, PermissionService permissions, AuditService auditService) {
        this.notifications = notifications;
        this.users = users;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        List<Notification> records = actor.hasRole(Role.FOUNDER)
            ? notifications.findByArchivedAtIsNullOrderByCreatedAtDesc()
            : notifications.findByRecipientEmailIgnoreCaseAndArchivedAtIsNullOrderByCreatedAtDesc(actor.getEmail());
        return records.stream().map(NotificationResponse::from).toList();
    }

    @Transactional
    public NotificationResponse markRead(UUID id, AppUser actor) {
        Notification notification = findVisible(id, actor);
        if (notification.getReadAt() == null) notification.setReadAt(Instant.now());
        Notification saved = notifications.saveAndFlush(notification);
        auditService.record(actor, MODULE, "NOTIFICATION_READ", "Marked notification read " + saved.getTitle(), "INFO");
        return NotificationResponse.from(saved);
    }

    @Transactional
    public void markAllRead(AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        List<Notification> records = actor.hasRole(Role.FOUNDER)
            ? notifications.findByArchivedAtIsNullOrderByCreatedAtDesc()
            : notifications.findByRecipientEmailIgnoreCaseAndArchivedAtIsNullOrderByCreatedAtDesc(actor.getEmail());
        Instant now = Instant.now();
        records.stream().filter(notification -> notification.getReadAt() == null).forEach(notification -> notification.setReadAt(now));
        notifications.saveAll(records);
        auditService.record(actor, MODULE, "NOTIFICATIONS_READ_ALL", "Marked visible notifications read", "INFO");
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        Notification notification = findVisible(id, actor);
        if (notification.getArchivedAt() == null) notification.setArchivedAt(Instant.now());
        notifications.saveAndFlush(notification);
        auditService.record(actor, MODULE, "NOTIFICATION_ARCHIVED", "Archived notification " + notification.getTitle(), "INFO");
    }

    @Transactional
    public void createForAudience(AnnouncementAudience audience, NotificationType type, String title, String message, String sourceModule, UUID sourceId, AppUser actor) {
        List<AppUser> recipients = users.findAll().stream()
            .filter(AppUser::isEnabled)
            .filter(user -> matchesAudience(user, audience))
            .sorted(Comparator.comparing(AppUser::getEmail))
            .toList();
        for (AppUser user : recipients) {
            Notification notification = new Notification();
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setType(type);
            notification.setRecipientEmail(user.getEmail());
            notification.setAudience(audience);
            notification.setSourceModule(sourceModule);
            notification.setSourceId(sourceId);
            notifications.save(notification);
        }
        auditService.record(actor, MODULE, "NOTIFICATIONS_CREATED", "Created " + recipients.size() + " notification(s) from " + sourceModule, "INFO");
    }

    private Notification findVisible(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        Notification notification = notifications.findById(id).orElseThrow(() -> new NotFoundException("Notification not found."));
        if (!actor.hasRole(Role.FOUNDER) && !notification.getRecipientEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new NotFoundException("Notification not found.");
        }
        return notification;
    }

    private boolean matchesAudience(AppUser user, AnnouncementAudience audience) {
        return switch (audience) {
            case EVERYONE -> true;
            case FOUNDER -> user.hasRole(Role.FOUNDER);
            case DIRECTOR -> user.hasRole(Role.DIRECTOR);
            case VIEWER -> user.hasRole(Role.VIEWER);
        };
    }
}