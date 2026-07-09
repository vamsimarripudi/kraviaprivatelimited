package com.kravia.companyos.ecosystem;

public record EcosystemSummaryResponse(
    long registeredProducts,
    long activeProducts,
    long launchReadyProducts,
    long liveProducts,
    long archivedProducts,
    long healthTrackedProducts,
    long revenueVisibleProducts,
    long complianceVisibleProducts,
    long securityVisibleProducts,
    long deploymentTrackedProducts,
    long roadmapTrackedProducts,
    long productsWithRisks
) {}
