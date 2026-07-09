package com.kravia.companyos.ecosystem;

import java.time.Instant;
import java.util.UUID;

public record EcosystemProductResponse(
    UUID id,
    String productName,
    String productCode,
    EcosystemProductStatus status,
    String owner,
    String description,
    String domain,
    String backendUrl,
    String frontendUrl,
    String currentVersion,
    String launchStatus,
    String revenueStatus,
    String complianceStatus,
    String securityStatus,
    String deploymentStatus,
    String healthNotes,
    String revenueNotes,
    String roadmapNotes,
    String launchChecklist,
    String riskRegister,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static EcosystemProductResponse from(EcosystemProduct product) {
        return new EcosystemProductResponse(
            product.getId(),
            product.getProductName(),
            product.getProductCode(),
            product.getStatus(),
            product.getOwner(),
            product.getDescription(),
            product.getDomain(),
            product.getBackendUrl(),
            product.getFrontendUrl(),
            product.getCurrentVersion(),
            product.getLaunchStatus(),
            product.getRevenueStatus(),
            product.getComplianceStatus(),
            product.getSecurityStatus(),
            product.getDeploymentStatus(),
            product.getHealthNotes(),
            product.getRevenueNotes(),
            product.getRoadmapNotes(),
            product.getLaunchChecklist(),
            product.getRiskRegister(),
            product.getCreatedBy(),
            product.getCreatedAt(),
            product.getUpdatedAt(),
            product.getArchivedAt()
        );
    }
}
