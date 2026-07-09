package com.kravia.companyos.approval;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ApprovalDecisionRequest(
    @NotNull(message = "Approval status is required.")
    ApprovalStatus status,

    @Size(max = 2000, message = "Approval notes are too long.")
    String approvalNotes,

    @Size(max = 2000, message = "Rejection reason is too long.")
    String rejectionReason
) {}
