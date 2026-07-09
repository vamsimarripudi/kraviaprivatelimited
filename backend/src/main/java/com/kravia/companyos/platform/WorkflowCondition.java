package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowConditionOperator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_conditions")
public class WorkflowCondition extends BaseEntity {
    private UUID templateId;
    private UUID ruleId;

    @Column(nullable = false, length = 160)
    private String fieldName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private WorkflowConditionOperator operator;

    @Column(length = 1000)
    private String expectedValue;

    @Column(length = 2000)
    private String description;

    private Instant archivedAt;

    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public UUID getRuleId() { return ruleId; }
    public void setRuleId(UUID ruleId) { this.ruleId = ruleId; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public WorkflowConditionOperator getOperator() { return operator; }
    public void setOperator(WorkflowConditionOperator operator) { this.operator = operator; }
    public String getExpectedValue() { return expectedValue; }
    public void setExpectedValue(String expectedValue) { this.expectedValue = expectedValue; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
