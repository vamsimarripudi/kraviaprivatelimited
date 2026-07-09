package com.kravia.companyos.contact;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

public record ContactResponse(
    UUID id,
    String name,
    String organization,
    String role,
    ContactCategory category,
    String phone,
    String email,
    String notes,
    UUID relatedDocumentId,
    UUID relatedTaskId,
    LocalDate lastContactedDate,
    LocalDate nextFollowUpDate,
    ContactStatus status,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt,
    boolean followUpDue,
    Long daysUntilFollowUp
) {
    private static final Set<ContactStatus> CLOSED_STATUSES = Set.of(ContactStatus.CLOSED, ContactStatus.ARCHIVED);

    public static ContactResponse from(CompanyContact contact) {
        LocalDate today = LocalDate.now();
        Long days = contact.getNextFollowUpDate() == null ? null : ChronoUnit.DAYS.between(today, contact.getNextFollowUpDate());
        boolean due = !CLOSED_STATUSES.contains(contact.getStatus()) && days != null && days <= 0;
        return new ContactResponse(
            contact.getId(),
            contact.getName(),
            contact.getOrganization(),
            contact.getRole(),
            contact.getCategory(),
            contact.getPhone(),
            contact.getEmail(),
            contact.getNotes(),
            contact.getRelatedDocumentId(),
            contact.getRelatedTaskId(),
            contact.getLastContactedDate(),
            contact.getNextFollowUpDate(),
            contact.getStatus(),
            contact.getCreatedBy(),
            contact.getCreatedAt(),
            contact.getUpdatedAt(),
            contact.getArchivedAt(),
            due,
            days
        );
    }
}