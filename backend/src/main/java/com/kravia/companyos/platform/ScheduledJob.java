package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobFrequency;
import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "scheduled_jobs")
public class ScheduledJob extends BaseEntity {
    @Column(nullable = false, length = 200)
    private String jobName;

    @Column(nullable = false, unique = true, length = 160)
    private String jobKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private ScheduledJobFrequency frequency;

    @Column(length = 120)
    private String cronExpression;

    private Instant nextRunAt;
    private Instant lastRunAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private ScheduledJobStatus status = ScheduledJobStatus.ACTIVE;

    @Column(length = 3000)
    private String actionSummary;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public String getJobKey() { return jobKey; }
    public void setJobKey(String jobKey) { this.jobKey = jobKey; }
    public ScheduledJobFrequency getFrequency() { return frequency; }
    public void setFrequency(ScheduledJobFrequency frequency) { this.frequency = frequency; }
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    public Instant getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(Instant nextRunAt) { this.nextRunAt = nextRunAt; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }
    public ScheduledJobStatus getStatus() { return status; }
    public void setStatus(ScheduledJobStatus status) { this.status = status; }
    public String getActionSummary() { return actionSummary; }
    public void setActionSummary(String actionSummary) { this.actionSummary = actionSummary; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
