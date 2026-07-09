package com.kravia.companyos.risk;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RiskResponse(
    UUID id,
    String title,
    RiskCategory category,
    String description,
    RiskLevel severity,
    RiskLevel likelihood,
    String owner,
    String mitigationPlan,
    RiskStatus status,
    LocalDate reviewDate,
    String relatedRecords,
    String createdBy,
    Instant createdAt,
    Instant updatedAt
) {
    public static RiskResponse from(RiskRegisterEntry risk) {
        return new RiskResponse(
            risk.getId(),
            risk.getTitle(),
            risk.getCategory(),
            risk.getDescription(),
            risk.getSeverity(),
            risk.getLikelihood(),
            risk.getOwner(),
            risk.getMitigationPlan(),
            risk.getStatus(),
            risk.getReviewDate(),
            risk.getRelatedRecords(),
            risk.getCreatedBy(),
            risk.getCreatedAt(),
            risk.getUpdatedAt()
        );
    }
}
