package com.kravia.companyos.platform;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WorkflowStateRequest(
    @NotNull(message = "Workflow state is required.")
    WorkflowState state,

    @Size(max = 1000, message = "Workflow note is too long.")
    String note
) {}
