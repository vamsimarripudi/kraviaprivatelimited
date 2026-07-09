package com.kravia.companyos.compliance;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

public record ComplianceItemResponse(
    UUID id,
    String title,
    ComplianceCategory category,
    String description,
    LocalDate dueDate,
    ComplianceStatus status,
    CompliancePriority priority,
    String responsiblePerson,
    UUID relatedDocumentId,
    String notes,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt,
    boolean overdue,
    boolean upcomingDue,
    Long daysUntilDue
) {
    private static final Set<ComplianceStatus> CLOSED_STATUSES = Set.of(
        ComplianceStatus.COMPLETED,
        ComplianceStatus.APPROVED,
        ComplianceStatus.NOT_APPLICABLE,
        ComplianceStatus.ARCHIVED
    );

    public static ComplianceItemResponse from(ComplianceItem item) {
        LocalDate today = LocalDate.now();
        Long days = item.getDueDate() == null ? null : ChronoUnit.DAYS.between(today, item.getDueDate());
        boolean open = !CLOSED_STATUSES.contains(item.getStatus());
        boolean overdue = open && days != null && days < 0;
        boolean upcoming = open && days != null && days >= 0 && days <= 14;
        return new ComplianceItemResponse(
            item.getId(),
            item.getTitle(),
            item.getCategory(),
            item.getDescription(),
            item.getDueDate(),
            item.getStatus(),
            item.getPriority(),
            item.getResponsiblePerson(),
            item.getRelatedDocumentId(),
            item.getNotes(),
            item.getCreatedBy(),
            item.getCreatedAt(),
            item.getUpdatedAt(),
            item.getArchivedAt(),
            overdue,
            upcoming,
            days
        );
    }
}
