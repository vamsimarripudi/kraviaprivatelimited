package com.kravia.companyos.risk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record RiskRequest(
    @NotBlank(message = "Risk title is required.")
    @Size(max = 240, message = "Risk title is too long.")
    String title,

    @NotNull(message = "Risk category is required.")
    RiskCategory category,

    @Size(max = 3000, message = "Risk description is too long.")
    String description,

    @NotNull(message = "Risk severity is required.")
    RiskLevel severity,

    @NotNull(message = "Risk likelihood is required.")
    RiskLevel likelihood,

    @Size(max = 320, message = "Risk owner is too long.")
    String owner,

    @Size(max = 3000, message = "Mitigation plan is too long.")
    String mitigationPlan,

    @NotNull(message = "Risk status is required.")
    RiskStatus status,

    LocalDate reviewDate,

    @Size(max = 2000, message = "Related records are too long.")
    String relatedRecords
) {}
