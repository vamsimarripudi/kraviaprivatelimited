package com.kravia.companyos.sales;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record SalesLeadResponse(
    UUID id,
    String leadName,
    String organizationName,
    String contactPerson,
    String phone,
    String email,
    String productInterest,
    String leadSource,
    LeadStage stage,
    LeadPriority priority,
    String assignedPerson,
    LocalDate lastContactedDate,
    LocalDate nextFollowUpDate,
    String notes,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt,
    boolean followUpDue,
    Long daysUntilFollowUp
) {
    public static SalesLeadResponse from(SalesLead lead) {
        LocalDate next = lead.getNextFollowUpDate();
        Long daysUntilFollowUp = next == null ? null : ChronoUnit.DAYS.between(LocalDate.now(), next);
        return new SalesLeadResponse(
            lead.getId(),
            lead.getLeadName(),
            lead.getOrganizationName(),
            lead.getContactPerson(),
            lead.getPhone(),
            lead.getEmail(),
            lead.getProductInterest(),
            lead.getLeadSource(),
            lead.getStage(),
            lead.getPriority(),
            lead.getAssignedPerson(),
            lead.getLastContactedDate(),
            next,
            lead.getNotes(),
            lead.getCreatedBy(),
            lead.getCreatedAt(),
            lead.getUpdatedAt(),
            lead.getArchivedAt(),
            next != null && !next.isAfter(LocalDate.now()) && lead.getArchivedAt() == null && lead.getStage() != LeadStage.WON && lead.getStage() != LeadStage.LOST && lead.getStage() != LeadStage.ARCHIVED,
            daysUntilFollowUp
        );
    }
}
