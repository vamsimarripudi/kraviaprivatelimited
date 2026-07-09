package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowNotificationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_notifications")
public class WorkflowNotification extends BaseEntity {
    private UUID workflowInstanceId;

    @Column(nullable = false, length = 240)
    private String title;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(length = 320)
    private String recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowNotificationStatus status = WorkflowNotificationStatus.PENDING;

    private Instant sentAt;
    private Instant archivedAt;

    public UUID getWorkflowInstanceId() { return workflowInstanceId; }
    public void setWorkflowInstanceId(UUID workflowInstanceId) { this.workflowInstanceId = workflowInstanceId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public WorkflowNotificationStatus getStatus() { return status; }
    public void setStatus(WorkflowNotificationStatus status) { this.status = status; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
