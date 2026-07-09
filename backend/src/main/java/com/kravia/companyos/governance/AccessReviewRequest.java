package com.kravia.companyos.governance;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AccessReviewRequest(
    @NotNull(message = "Access review status is required.")
    AccessReviewStatus reviewStatus,

    @Size(max = 2000, message = "Access review notes are too long.")
    String notes
) {}
