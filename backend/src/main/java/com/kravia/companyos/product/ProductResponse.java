package com.kravia.companyos.product;

import java.time.Instant;
import java.util.UUID;

public record ProductResponse(
    UUID id,
    String name,
    ProductCategory category,
    String description,
    ProductStatus status,
    String developmentStage,
    Integer launchReadinessPercentage,
    String targetUsers,
    String pricingNotes,
    String revenueNotes,
    String keyFeatures,
    String pendingWork,
    String risks,
    String nextMilestone,
    String responsiblePerson,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static ProductResponse from(CompanyProduct product) {
        return new ProductResponse(
            product.getId(),
            product.getName(),
            product.getCategory(),
            product.getDescription(),
            product.getStatus(),
            product.getDevelopmentStage(),
            product.getLaunchReadinessPercentage(),
            product.getTargetUsers(),
            product.getPricingNotes(),
            product.getRevenueNotes(),
            product.getKeyFeatures(),
            product.getPendingWork(),
            product.getRisks(),
            product.getNextMilestone(),
            product.getResponsiblePerson(),
            product.getCreatedBy(),
            product.getCreatedAt(),
            product.getUpdatedAt(),
            product.getArchivedAt()
        );
    }
}