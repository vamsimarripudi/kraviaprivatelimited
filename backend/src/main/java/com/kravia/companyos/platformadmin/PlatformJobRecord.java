package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "platform_jobs")
public class PlatformJobRecord extends BaseEntity {
    @Column(nullable = false, length = 160)
    private String jobName;

    @Column(nullable = false, length = 80)
    private String jobType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private PlatformJobStatus status = PlatformJobStatus.NOT_CONFIGURED;

    private Instant lastRunAt;
    private Instant nextRunAt;

    @Column(length = 320)
    private String owner;

    @Column(length = 2000)
    private String notes;

    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public String getJobType() { return jobType; }
    public void setJobType(String jobType) { this.jobType = jobType; }
    public PlatformJobStatus getStatus() { return status; }
    public void setStatus(PlatformJobStatus status) { this.status = status; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }
    public Instant getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(Instant nextRunAt) { this.nextRunAt = nextRunAt; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
