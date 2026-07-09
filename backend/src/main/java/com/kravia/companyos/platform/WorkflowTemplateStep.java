package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowApprovalMode;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_steps")
public class WorkflowTemplateStep extends BaseEntity {
    @Column(nullable = false)
    private UUID templateId;

    @Column(nullable = false)
    private Integer stepOrder;

    @Column(nullable = false, length = 200)
    private String stepName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowStepType stepType = WorkflowStepType.REVIEW;

    @Enumerated(EnumType.STRING)
    @Column(length = 60)
    private WorkflowApprovalMode approvalMode;

    @Column(length = 80)
    private String approverRole;

    @Column(length = 320)
    private String approverUser;

    @Enumerated(EnumType.STRING)
    @Column(length = 80)
    private WorkflowActionType actionType;

    @Column(length = 80)
    private String notificationAudience;

    private Integer escalationAfterHours;

    @Column(length = 3000)
    private String conditionsSummary;

    @Column(length = 3000)
    private String completionRule;

    @Column(nullable = false)
    private boolean requiredStep = true;

    private Instant archivedAt;

    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public Integer getStepOrder() { return stepOrder; }
    public void setStepOrder(Integer stepOrder) { this.stepOrder = stepOrder; }
    public String getStepName() { return stepName; }
    public void setStepName(String stepName) { this.stepName = stepName; }
    public WorkflowStepType getStepType() { return stepType; }
    public void setStepType(WorkflowStepType stepType) { this.stepType = stepType; }
    public WorkflowApprovalMode getApprovalMode() { return approvalMode; }
    public void setApprovalMode(WorkflowApprovalMode approvalMode) { this.approvalMode = approvalMode; }
    public String getApproverRole() { return approverRole; }
    public void setApproverRole(String approverRole) { this.approverRole = approverRole; }
    public String getApproverUser() { return approverUser; }
    public void setApproverUser(String approverUser) { this.approverUser = approverUser; }
    public WorkflowActionType getActionType() { return actionType; }
    public void setActionType(WorkflowActionType actionType) { this.actionType = actionType; }
    public String getNotificationAudience() { return notificationAudience; }
    public void setNotificationAudience(String notificationAudience) { this.notificationAudience = notificationAudience; }
    public Integer getEscalationAfterHours() { return escalationAfterHours; }
    public void setEscalationAfterHours(Integer escalationAfterHours) { this.escalationAfterHours = escalationAfterHours; }
    public String getConditionsSummary() { return conditionsSummary; }
    public void setConditionsSummary(String conditionsSummary) { this.conditionsSummary = conditionsSummary; }
    public String getCompletionRule() { return completionRule; }
    public void setCompletionRule(String completionRule) { this.completionRule = completionRule; }
    public boolean isRequiredStep() { return requiredStep; }
    public void setRequiredStep(boolean requiredStep) { this.requiredStep = requiredStep; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
