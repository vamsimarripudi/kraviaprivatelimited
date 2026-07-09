package com.kravia.companyos.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

public record CompanyTaskResponse(
    UUID id,
    String title,
    TaskCategory category,
    String description,
    String assignedTo,
    LocalDate dueDate,
    TaskPriority priority,
    TaskStatus status,
    String relatedSection,
    UUID relatedDocumentId,
    String notes,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant completedAt,
    Instant archivedAt,
    boolean overdue,
    Long daysUntilDue
) {
    private static final Set<TaskStatus> CLOSED_STATUSES = Set.of(TaskStatus.DONE, TaskStatus.ARCHIVED);

    public static CompanyTaskResponse from(CompanyTask task) {
        LocalDate today = LocalDate.now();
        Long days = task.getDueDate() == null ? null : ChronoUnit.DAYS.between(today, task.getDueDate());
        boolean overdue = !CLOSED_STATUSES.contains(task.getStatus()) && days != null && days < 0;
        return new CompanyTaskResponse(
            task.getId(),
            task.getTitle(),
            task.getCategory(),
            task.getDescription(),
            task.getAssignedTo(),
            task.getDueDate(),
            task.getPriority(),
            task.getStatus(),
            task.getRelatedSection(),
            task.getRelatedDocumentId(),
            task.getNotes(),
            task.getCreatedBy(),
            task.getCreatedAt(),
            task.getUpdatedAt(),
            task.getCompletedAt(),
            task.getArchivedAt(),
            overdue,
            days
        );
    }
}