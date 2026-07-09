package com.kravia.companyos.approval;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ApprovalRequestDto(
    @NotBlank(message = "Approval title is required.")
    @Size(max = 240, message = "Approval title is too long.")
    String title,

    @Size(max = 3000, message = "Approval description is too long.")
    String description,

    @NotNull(message = "Approval status is required.")
    ApprovalStatus status,

    @Size(max = 320, message = "Approver is too long.")
    String approver,

    @Size(max = 2000, message = "Approval notes are too long.")
    String approvalNotes,

    @Size(max = 2000, message = "Rejection reason is too long.")
    String rejectionReason,

    @Size(max = 80, message = "Linked module is too long.")
    String linkedModule,

    UUID linkedRecordId
) {}
