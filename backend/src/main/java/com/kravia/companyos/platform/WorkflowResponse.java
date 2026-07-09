package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WorkflowResponse(
    UUID id,
    WorkflowType workflowType,
    String title,
    WorkflowState state,
    String assignee,
    String relatedModule,
    UUID relatedRecordId,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    List<WorkflowCommentResponse> comments,
    List<WorkflowHistoryResponse> history
) {
    public static WorkflowResponse from(WorkflowInstance workflow, List<WorkflowComment> comments, List<WorkflowHistory> history) {
        return new WorkflowResponse(
            workflow.getId(),
            workflow.getWorkflowType(),
            workflow.getTitle(),
            workflow.getState(),
            workflow.getAssignee(),
            workflow.getRelatedModule(),
            workflow.getRelatedRecordId(),
            workflow.getCreatedBy(),
            workflow.getCreatedAt(),
            workflow.getUpdatedAt(),
            comments.stream().map(WorkflowCommentResponse::from).toList(),
            history.stream().map(WorkflowHistoryResponse::from).toList()
        );
    }
}
