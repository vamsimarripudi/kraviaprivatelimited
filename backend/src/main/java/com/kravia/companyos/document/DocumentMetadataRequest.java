package com.kravia.companyos.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DocumentMetadataRequest(
    @NotBlank @Size(max = 255) String title,
    @NotNull DocumentCategory category,
    @Size(max = 2000) String description,
    @NotNull DocumentStatus status
) {}
