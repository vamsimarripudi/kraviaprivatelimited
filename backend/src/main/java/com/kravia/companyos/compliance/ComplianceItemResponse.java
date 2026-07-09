package com.kravia.companyos.compliance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ComplianceItemResponse(UUID id, String title, String status, String ownerName, LocalDate dueDate, String category, String referenceCode, BigDecimal amount, String details, String notes, boolean archived, Instant createdAt, Instant updatedAt) {
    public static ComplianceItemResponse from(ComplianceItem record) {
        return new ComplianceItemResponse(record.getId(), record.getTitle(), record.getStatus(), record.getOwnerName(), record.getDueDate(), record.getCategory(), record.getReferenceCode(), record.getAmount(), record.getDetails(), record.getNotes(), record.isArchived(), record.getCreatedAt(), record.getUpdatedAt());
    }
}
