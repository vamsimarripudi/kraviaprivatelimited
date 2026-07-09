package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "workflow_comments")
public class WorkflowComment extends BaseEntity {
    @Column(nullable = false)
    private UUID workflowId;

    @Column(nullable = false, length = 320)
    private String author;

    @Column(nullable = false, length = 2000)
    private String commentText;

    public UUID getWorkflowId() { return workflowId; }
    public void setWorkflowId(UUID workflowId) { this.workflowId = workflowId; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getCommentText() { return commentText; }
    public void setCommentText(String commentText) { this.commentText = commentText; }
}
