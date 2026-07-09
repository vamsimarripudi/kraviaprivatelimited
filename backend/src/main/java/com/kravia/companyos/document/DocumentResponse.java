package com.kravia.companyos.document;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(UUID id, String title, String category, String contentType, long sizeBytes, String uploadedBy, String status, String versionLabel, Instant createdAt, Instant updatedAt) {
    public static DocumentResponse from(DocumentRecord record) {
        return new DocumentResponse(record.getId(), record.getTitle(), record.getCategory(), record.getContentType(), record.getSizeBytes(), record.getUploadedBy(), record.getStatus(), record.getVersionLabel(), record.getCreatedAt(), record.getUpdatedAt());
    }
}
