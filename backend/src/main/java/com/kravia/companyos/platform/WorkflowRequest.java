package com.kravia.companyos.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record WorkflowRequest(
    @NotNull(message = "Workflow type is required.")
    WorkflowType workflowType,

    @NotBlank(message = "Workflow title is required.")
    @Size(max = 240, message = "Workflow title is too long.")
    String title,

    WorkflowState state,

    @Size(max = 320, message = "Assignee is too long.")
    String assignee,

    @Size(max = 80, message = "Related module is too long.")
    String relatedModule,

    UUID relatedRecordId
) {}
