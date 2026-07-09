package com.kravia.companyos.approval;

import java.time.Instant;
import java.util.UUID;

public record ApprovalResponse(
    UUID id,
    String title,
    String description,
    ApprovalStatus status,
    String approver,
    String approvalNotes,
    Instant approvalDate,
    String rejectionReason,
    String linkedModule,
    UUID linkedRecordId,
    String createdBy,
    Instant createdAt,
    Instant updatedAt
) {
    public static ApprovalResponse from(ApprovalRequestEntity approval) {
        return new ApprovalResponse(
            approval.getId(),
            approval.getTitle(),
            approval.getDescription(),
            approval.getStatus(),
            approval.getApprover(),
            approval.getApprovalNotes(),
            approval.getApprovalDate(),
            approval.getRejectionReason(),
            approval.getLinkedModule(),
            approval.getLinkedRecordId(),
            approval.getCreatedBy(),
            approval.getCreatedAt(),
            approval.getUpdatedAt()
        );
    }
}
