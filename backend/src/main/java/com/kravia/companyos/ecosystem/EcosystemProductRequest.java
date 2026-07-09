package com.kravia.companyos.ecosystem;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EcosystemProductRequest(
    @NotBlank @Size(max = 255) String productName,
    @NotBlank @Pattern(regexp = "^[A-Z0-9][A-Z0-9_-]{1,39}$", message = "Product code must use uppercase letters, numbers, hyphen, or underscore.") String productCode,
    @NotNull EcosystemProductStatus status,
    @NotBlank @Size(max = 255) String owner,
    @Size(max = 3000) String description,
    @Size(max = 255) String domain,
    @Size(max = 500) String backendUrl,
    @Size(max = 500) String frontendUrl,
    @Size(max = 80) String currentVersion,
    @Size(max = 255) String launchStatus,
    @Size(max = 255) String revenueStatus,
    @Size(max = 255) String complianceStatus,
    @Size(max = 255) String securityStatus,
    @Size(max = 255) String deploymentStatus,
    @Size(max = 3000) String healthNotes,
    @Size(max = 3000) String revenueNotes,
    @Size(max = 3000) String roadmapNotes,
    @Size(max = 3000) String launchChecklist,
    @Size(max = 3000) String riskRegister
) {}
