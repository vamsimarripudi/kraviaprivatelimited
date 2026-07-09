package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowRuleStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "workflow_rules")
public class WorkflowRule extends BaseEntity {
    @Column(nullable = false, length = 200)
    private String ruleName;

    @Column(nullable = false, length = 80)
    private String triggerModule;

    @Column(nullable = false, length = 120)
    private String triggerEvent;

    @Column(length = 3000)
    private String conditionSummary;

    @Column(length = 3000)
    private String actionSummary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private WorkflowRuleStatus status = WorkflowRuleStatus.DRAFT;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }
    public String getTriggerModule() { return triggerModule; }
    public void setTriggerModule(String triggerModule) { this.triggerModule = triggerModule; }
    public String getTriggerEvent() { return triggerEvent; }
    public void setTriggerEvent(String triggerEvent) { this.triggerEvent = triggerEvent; }
    public String getConditionSummary() { return conditionSummary; }
    public void setConditionSummary(String conditionSummary) { this.conditionSummary = conditionSummary; }
    public String getActionSummary() { return actionSummary; }
    public void setActionSummary(String actionSummary) { this.actionSummary = actionSummary; }
    public WorkflowRuleStatus getStatus() { return status; }
    public void setStatus(WorkflowRuleStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
