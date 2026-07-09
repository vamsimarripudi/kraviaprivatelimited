package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.UUID;

public record CrossModuleLinkResponse(
    UUID id,
    String sourceModule,
    UUID sourceRecordId,
    String targetModule,
    UUID targetRecordId,
    String relationshipType,
    String label,
    Instant updatedAt
) {
    public static CrossModuleLinkResponse from(CrossModuleLink link) {
        return new CrossModuleLinkResponse(
            link.getId(),
            link.getSourceModule(),
            link.getSourceRecordId(),
            link.getTargetModule(),
            link.getTargetRecordId(),
            link.getRelationshipType(),
            link.getLabel(),
            link.getUpdatedAt()
        );
    }
}
