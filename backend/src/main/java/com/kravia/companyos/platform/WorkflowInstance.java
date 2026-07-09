package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_instances")
public class WorkflowInstance extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private WorkflowType workflowType;

    @Column(nullable = false, length = 240)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private WorkflowState state = WorkflowState.DRAFT;

    @Column(length = 320)
    private String assignee;

    @Column(length = 80)
    private String relatedModule;

    private UUID relatedRecordId;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public WorkflowType getWorkflowType() { return workflowType; }
    public void setWorkflowType(WorkflowType workflowType) { this.workflowType = workflowType; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public WorkflowState getState() { return state; }
    public void setState(WorkflowState state) { this.state = state; }
    public String getAssignee() { return assignee; }
    public void setAssignee(String assignee) { this.assignee = assignee; }
    public String getRelatedModule() { return relatedModule; }
    public void setRelatedModule(String relatedModule) { this.relatedModule = relatedModule; }
    public UUID getRelatedRecordId() { return relatedRecordId; }
    public void setRelatedRecordId(UUID relatedRecordId) { this.relatedRecordId = relatedRecordId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
