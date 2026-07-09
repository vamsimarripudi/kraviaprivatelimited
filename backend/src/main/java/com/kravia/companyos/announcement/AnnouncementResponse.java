package com.kravia.companyos.announcement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AnnouncementResponse(
    UUID id,
    String title,
    String message,
    AnnouncementAudience audience,
    AnnouncementStatus status,
    LocalDate expiresAt,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant publishedAt,
    Instant pinnedAt,
    Instant archivedAt
) {
    public static AnnouncementResponse from(Announcement announcement) {
        return new AnnouncementResponse(
            announcement.getId(),
            announcement.getTitle(),
            announcement.getMessage(),
            announcement.getAudience(),
            announcement.getStatus(),
            announcement.getExpiresAt(),
            announcement.getCreatedBy(),
            announcement.getCreatedAt(),
            announcement.getUpdatedAt(),
            announcement.getPublishedAt(),
            announcement.getPinnedAt(),
            announcement.getArchivedAt()
        );
    }
}