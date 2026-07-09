package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTemplateStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTriggerType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "workflow_templates")
public class WorkflowTemplate extends BaseEntity {
    @Column(nullable = false, length = 200)
    private String templateName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private WorkflowType workflowType;

    @Column(length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private WorkflowTemplateStatus status = WorkflowTemplateStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowTriggerType triggerType = WorkflowTriggerType.MANUAL;

    @Column(length = 80)
    private String triggerModule;

    @Column(length = 3000)
    private String conditionsSummary;

    @Column(length = 3000)
    private String completionRules;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public WorkflowType getWorkflowType() { return workflowType; }
    public void setWorkflowType(WorkflowType workflowType) { this.workflowType = workflowType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public WorkflowTemplateStatus getStatus() { return status; }
    public void setStatus(WorkflowTemplateStatus status) { this.status = status; }
    public WorkflowTriggerType getTriggerType() { return triggerType; }
    public void setTriggerType(WorkflowTriggerType triggerType) { this.triggerType = triggerType; }
    public String getTriggerModule() { return triggerModule; }
    public void setTriggerModule(String triggerModule) { this.triggerModule = triggerModule; }
    public String getConditionsSummary() { return conditionsSummary; }
    public void setConditionsSummary(String conditionsSummary) { this.conditionsSummary = conditionsSummary; }
    public String getCompletionRules() { return completionRules; }
    public void setCompletionRules(String completionRules) { this.completionRules = completionRules; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
