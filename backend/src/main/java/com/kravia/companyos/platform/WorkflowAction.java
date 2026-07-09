package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_actions")
public class WorkflowAction extends BaseEntity {
    private UUID templateId;
    private UUID workflowInstanceId;
    private UUID instanceStepId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private WorkflowActionType actionType;

    @Column(nullable = false, length = 200)
    private String actionName;

    @Column(length = 5000)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowActionStatus status = WorkflowActionStatus.PENDING;

    private Instant executedAt;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getWorkflowInstanceId() { return workflowInstanceId; }
    public void setWorkflowInstanceId(UUID workflowInstanceId) { this.workflowInstanceId = workflowInstanceId; }
    public UUID getInstanceStepId() { return instanceStepId; }
    public void setInstanceStepId(UUID instanceStepId) { this.instanceStepId = instanceStepId; }
    public WorkflowActionType getActionType() { return actionType; }
    public void setActionType(WorkflowActionType actionType) { this.actionType = actionType; }
    public String getActionName() { return actionName; }
    public void setActionName(String actionName) { this.actionName = actionName; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public WorkflowActionStatus getStatus() { return status; }
    public void setStatus(WorkflowActionStatus status) { this.status = status; }
    public Instant getExecutedAt() { return executedAt; }
    public void setExecutedAt(Instant executedAt) { this.executedAt = executedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
