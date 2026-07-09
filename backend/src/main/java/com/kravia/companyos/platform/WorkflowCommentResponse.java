package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.UUID;

public record WorkflowCommentResponse(UUID id, String author, String comment, Instant createdAt) {
    public static WorkflowCommentResponse from(WorkflowComment comment) {
        return new WorkflowCommentResponse(comment.getId(), comment.getAuthor(), comment.getCommentText(), comment.getCreatedAt());
    }
}
