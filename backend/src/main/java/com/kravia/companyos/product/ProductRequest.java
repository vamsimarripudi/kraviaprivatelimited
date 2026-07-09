package com.kravia.companyos.product;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProductRequest(
    @NotBlank @Size(max = 255) String name,
    @NotNull ProductCategory category,
    @Size(max = 3000) String description,
    @NotNull ProductStatus status,
    @NotBlank @Size(max = 255) String developmentStage,
    @NotNull @Min(0) @Max(100) Integer launchReadinessPercentage,
    @Size(max = 1500) String targetUsers,
    @Size(max = 1500) String pricingNotes,
    @Size(max = 1500) String revenueNotes,
    @Size(max = 3000) String keyFeatures,
    @Size(max = 3000) String pendingWork,
    @Size(max = 3000) String risks,
    @Size(max = 255) String nextMilestone,
    @Size(max = 255) String responsiblePerson
) {}