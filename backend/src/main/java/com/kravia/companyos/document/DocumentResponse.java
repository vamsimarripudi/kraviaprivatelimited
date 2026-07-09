package com.kravia.companyos.document;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(
    UUID id,
    String title,
    DocumentCategory category,
    String description,
    DocumentStatus status,
    String fileName,
    String fileType,
    long fileSize,
    int version,
    String uploadedBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static DocumentResponse from(DocumentRecord document) {
        return new DocumentResponse(
            document.getId(),
            document.getTitle(),
            document.getCategory(),
            document.getDescription(),
            document.getStatus(),
            document.getFileName(),
            document.getFileType(),
            document.getFileSize(),
            document.getVersion(),
            document.getUploadedBy(),
            document.getCreatedAt(),
            document.getUpdatedAt(),
            document.getArchivedAt()
        );
    }
}
