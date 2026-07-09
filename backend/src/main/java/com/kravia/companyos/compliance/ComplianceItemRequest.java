package com.kravia.companyos.compliance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record ComplianceItemRequest(
    @NotBlank @Size(max = 255) String title,
    @NotNull ComplianceCategory category,
    @Size(max = 3000) String description,
    LocalDate dueDate,
    @NotNull ComplianceStatus status,
    @NotNull CompliancePriority priority,
    @Size(max = 255) String responsiblePerson,
    UUID relatedDocumentId,
    @Size(max = 4000) String notes
) {}
