package com.kravia.companyos.sales;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record SalesLeadRequest(
    @NotBlank @Size(max = 255) String leadName,
    @NotBlank @Size(max = 255) String organizationName,
    @Size(max = 255) String contactPerson,
    @Size(max = 80) String phone,
    @Email @Size(max = 255) String email,
    @NotBlank @Size(max = 255) String productInterest,
    @Size(max = 255) String leadSource,
    @NotNull LeadStage stage,
    @NotNull LeadPriority priority,
    @Size(max = 255) String assignedPerson,
    LocalDate lastContactedDate,
    LocalDate nextFollowUpDate,
    @Size(max = 4000) String notes
) {}
