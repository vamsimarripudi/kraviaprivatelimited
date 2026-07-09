package com.kravia.companyos.privacy;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "data_privacy_records")
public class DataPrivacyRecord extends BaseEntity {
    @Column(nullable = false, length = 80)
    private String moduleName;

    private UUID recordId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DataClassification classification = DataClassification.INTERNAL;

    @Column(nullable = false)
    private boolean sensitiveDocument;

    @Column(length = 1000)
    private String accessVisibility;

    @Column(length = 1000)
    private String retentionRule;

    private Instant exportRequestedAt;
    private Instant deletionRequestedAt;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getModuleName() { return moduleName; }
    public void setModuleName(String moduleName) { this.moduleName = moduleName; }
    public UUID getRecordId() { return recordId; }
    public void setRecordId(UUID recordId) { this.recordId = recordId; }
    public DataClassification getClassification() { return classification; }
    public void setClassification(DataClassification classification) { this.classification = classification; }
    public boolean isSensitiveDocument() { return sensitiveDocument; }
    public void setSensitiveDocument(boolean sensitiveDocument) { this.sensitiveDocument = sensitiveDocument; }
    public String getAccessVisibility() { return accessVisibility; }
    public void setAccessVisibility(String accessVisibility) { this.accessVisibility = accessVisibility; }
    public String getRetentionRule() { return retentionRule; }
    public void setRetentionRule(String retentionRule) { this.retentionRule = retentionRule; }
    public Instant getExportRequestedAt() { return exportRequestedAt; }
    public void setExportRequestedAt(Instant exportRequestedAt) { this.exportRequestedAt = exportRequestedAt; }
    public Instant getDeletionRequestedAt() { return deletionRequestedAt; }
    public void setDeletionRequestedAt(Instant deletionRequestedAt) { this.deletionRequestedAt = deletionRequestedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
