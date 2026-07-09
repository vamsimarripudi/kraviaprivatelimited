package com.kravia.companyos.contact;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ContactRecordResponse(UUID id, String title, String status, String ownerName, LocalDate dueDate, String category, String referenceCode, BigDecimal amount, String details, String notes, boolean archived, Instant createdAt, Instant updatedAt) {
    public static ContactRecordResponse from(ContactRecord record) {
        return new ContactRecordResponse(record.getId(), record.getTitle(), record.getStatus(), record.getOwnerName(), record.getDueDate(), record.getCategory(), record.getReferenceCode(), record.getAmount(), record.getDetails(), record.getNotes(), record.isArchived(), record.getCreatedAt(), record.getUpdatedAt());
    }
}
