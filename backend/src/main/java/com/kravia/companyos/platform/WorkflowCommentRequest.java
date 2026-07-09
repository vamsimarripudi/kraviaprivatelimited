package com.kravia.companyos.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkflowCommentRequest(
    @NotBlank(message = "Comment is required.")
    @Size(max = 2000, message = "Comment is too long.")
    String comment
) {}
