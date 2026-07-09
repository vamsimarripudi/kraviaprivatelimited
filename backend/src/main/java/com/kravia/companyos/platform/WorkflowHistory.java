package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "workflow_history")
public class WorkflowHistory extends BaseEntity {
    @Column(nullable = false)
    private UUID workflowId;

    @Column(nullable = false, length = 320)
    private String actor;

    @Column(length = 60)
    private String fromState;

    @Column(nullable = false, length = 60)
    private String toState;

    @Column(length = 1000)
    private String note;

    public UUID getWorkflowId() { return workflowId; }
    public void setWorkflowId(UUID workflowId) { this.workflowId = workflowId; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getFromState() { return fromState; }
    public void setFromState(String fromState) { this.fromState = fromState; }
    public String getToState() { return toState; }
    public void setToState(String toState) { this.toState = toState; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
