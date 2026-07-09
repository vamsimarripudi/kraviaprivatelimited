package com.kravia.companyos.notification;

import com.kravia.companyos.announcement.AnnouncementAudience;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
    UUID id,
    String title,
    String message,
    NotificationType type,
    String recipientEmail,
    AnnouncementAudience audience,
    String sourceModule,
    UUID sourceId,
    Instant createdAt,
    Instant updatedAt,
    Instant readAt,
    Instant archivedAt,
    boolean read
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getType(),
            notification.getRecipientEmail(),
            notification.getAudience(),
            notification.getSourceModule(),
            notification.getSourceId(),
            notification.getCreatedAt(),
            notification.getUpdatedAt(),
            notification.getReadAt(),
            notification.getArchivedAt(),
            notification.getReadAt() != null
        );
    }
}