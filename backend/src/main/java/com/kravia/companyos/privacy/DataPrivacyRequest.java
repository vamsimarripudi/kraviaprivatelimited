package com.kravia.companyos.privacy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record DataPrivacyRequest(
    @NotBlank(message = "Module name is required.")
    @Size(max = 80, message = "Module name is too long.")
    String moduleName,

    UUID recordId,

    @NotNull(message = "Data classification is required.")
    DataClassification classification,

    boolean sensitiveDocument,

    @Size(max = 1000, message = "Access visibility is too long.")
    String accessVisibility,

    @Size(max = 1000, message = "Retention rule is too long.")
    String retentionRule
) {}
