package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "platform_backups")
public class PlatformBackupRecord extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BackupType backupType;

    private Instant lastBackupAt;
    private Instant nextScheduledBackupAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private BackupStatus backupStatus = BackupStatus.NOT_CONFIGURED;

    private Long backupSizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private RestoreTestStatus restoreTestStatus = RestoreTestStatus.NOT_TESTED;

    @Column(length = 2000)
    private String notes;

    public BackupType getBackupType() { return backupType; }
    public void setBackupType(BackupType backupType) { this.backupType = backupType; }
    public Instant getLastBackupAt() { return lastBackupAt; }
    public void setLastBackupAt(Instant lastBackupAt) { this.lastBackupAt = lastBackupAt; }
    public Instant getNextScheduledBackupAt() { return nextScheduledBackupAt; }
    public void setNextScheduledBackupAt(Instant nextScheduledBackupAt) { this.nextScheduledBackupAt = nextScheduledBackupAt; }
    public BackupStatus getBackupStatus() { return backupStatus; }
    public void setBackupStatus(BackupStatus backupStatus) { this.backupStatus = backupStatus; }
    public Long getBackupSizeBytes() { return backupSizeBytes; }
    public void setBackupSizeBytes(Long backupSizeBytes) { this.backupSizeBytes = backupSizeBytes; }
    public RestoreTestStatus getRestoreTestStatus() { return restoreTestStatus; }
    public void setRestoreTestStatus(RestoreTestStatus restoreTestStatus) { this.restoreTestStatus = restoreTestStatus; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
