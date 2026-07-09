package com.kravia.companyos.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CrossModuleLinkRequest(
    @NotBlank(message = "Source module is required.")
    @Size(max = 80, message = "Source module is too long.")
    String sourceModule,

    @NotNull(message = "Source record ID is required.")
    UUID sourceRecordId,

    @NotBlank(message = "Target module is required.")
    @Size(max = 80, message = "Target module is too long.")
    String targetModule,

    @NotNull(message = "Target record ID is required.")
    UUID targetRecordId,

    @NotBlank(message = "Relationship type is required.")
    @Size(max = 80, message = "Relationship type is too long.")
    String relationshipType,

    @Size(max = 240, message = "Relationship label is too long.")
    String label
) {}
