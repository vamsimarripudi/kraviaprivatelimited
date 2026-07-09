package com.kravia.companyos.announcement;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "announcements")
public class Announcement extends BaseEntity {
    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 6000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AnnouncementAudience audience = AnnouncementAudience.EVERYONE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AnnouncementStatus status = AnnouncementStatus.DRAFT;

    private LocalDate expiresAt;

    @Column(nullable = false)
    private String createdBy;

    private Instant publishedAt;

    private Instant pinnedAt;

    private Instant archivedAt;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public AnnouncementAudience getAudience() { return audience; }
    public void setAudience(AnnouncementAudience audience) { this.audience = audience; }
    public AnnouncementStatus getStatus() { return status; }
    public void setStatus(AnnouncementStatus status) { this.status = status; }
    public LocalDate getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDate expiresAt) { this.expiresAt = expiresAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Instant getPinnedAt() { return pinnedAt; }
    public void setPinnedAt(Instant pinnedAt) { this.pinnedAt = pinnedAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}