package com.kravia.companyos.contact;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record ContactRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 255) String organization,
    @Size(max = 255) String role,
    @NotNull ContactCategory category,
    @Size(max = 60) String phone,
    @Email @Size(max = 255) String email,
    @Size(max = 4000) String notes,
    UUID relatedDocumentId,
    UUID relatedTaskId,
    LocalDate lastContactedDate,
    LocalDate nextFollowUpDate,
    @NotNull ContactStatus status
) {}