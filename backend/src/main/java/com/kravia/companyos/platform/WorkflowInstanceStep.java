package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowApprovalMode;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_instance_steps")
public class WorkflowInstanceStep extends BaseEntity {
    @Column(nullable = false)
    private UUID workflowInstanceId;

    private UUID templateStepId;

    @Column(nullable = false)
    private Integer stepOrder;

    @Column(nullable = false, length = 200)
    private String stepName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowStepType stepType;

    @Enumerated(EnumType.STRING)
    @Column(length = 60)
    private WorkflowApprovalMode approvalMode;

    @Column(length = 320)
    private String approver;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowStepStatus status = WorkflowStepStatus.PENDING;

    private Instant startedAt;
    private Instant completedAt;

    @Column(length = 2000)
    private String note;

    public UUID getWorkflowInstanceId() { return workflowInstanceId; }
    public void setWorkflowInstanceId(UUID workflowInstanceId) { this.workflowInstanceId = workflowInstanceId; }
    public UUID getTemplateStepId() { return templateStepId; }
    public void setTemplateStepId(UUID templateStepId) { this.templateStepId = templateStepId; }
    public Integer getStepOrder() { return stepOrder; }
    public void setStepOrder(Integer stepOrder) { this.stepOrder = stepOrder; }
    public String getStepName() { return stepName; }
    public void setStepName(String stepName) { this.stepName = stepName; }
    public WorkflowStepType getStepType() { return stepType; }
    public void setStepType(WorkflowStepType stepType) { this.stepType = stepType; }
    public WorkflowApprovalMode getApprovalMode() { return approvalMode; }
    public void setApprovalMode(WorkflowApprovalMode approvalMode) { this.approvalMode = approvalMode; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public WorkflowStepStatus getStatus() { return status; }
    public void setStatus(WorkflowStepStatus status) { this.status = status; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
