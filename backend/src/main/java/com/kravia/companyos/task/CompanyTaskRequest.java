package com.kravia.companyos.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record CompanyTaskRequest(
    @NotBlank @Size(max = 255) String title,
    @NotNull TaskCategory category,
    @Size(max = 3000) String description,
    @Size(max = 255) String assignedTo,
    LocalDate dueDate,
    @NotNull TaskPriority priority,
    @NotNull TaskStatus status,
    @Size(max = 255) String relatedSection,
    UUID relatedDocumentId,
    @Size(max = 4000) String notes
) {}