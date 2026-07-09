package com.kravia.companyos.privacy;

import java.time.Instant;
import java.util.UUID;

public record DataPrivacyResponse(
    UUID id,
    String moduleName,
    UUID recordId,
    DataClassification classification,
    boolean sensitiveDocument,
    String accessVisibility,
    String retentionRule,
    Instant exportRequestedAt,
    Instant deletionRequestedAt,
    String createdBy,
    Instant createdAt,
    Instant updatedAt
) {
    public static DataPrivacyResponse from(DataPrivacyRecord record) {
        return new DataPrivacyResponse(
            record.getId(),
            record.getModuleName(),
            record.getRecordId(),
            record.getClassification(),
            record.isSensitiveDocument(),
            record.getAccessVisibility(),
            record.getRetentionRule(),
            record.getExportRequestedAt(),
            record.getDeletionRequestedAt(),
            record.getCreatedBy(),
            record.getCreatedAt(),
            record.getUpdatedAt()
        );
    }
}
