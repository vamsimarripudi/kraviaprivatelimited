package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "cross_module_links")
public class CrossModuleLink extends BaseEntity {
    @Column(nullable = false, length = 80)
    private String sourceModule;

    @Column(nullable = false)
    private UUID sourceRecordId;

    @Column(nullable = false, length = 80)
    private String targetModule;

    @Column(nullable = false)
    private UUID targetRecordId;

    @Column(nullable = false, length = 80)
    private String relationshipType;

    @Column(length = 240)
    private String label;

    public String getSourceModule() { return sourceModule; }
    public void setSourceModule(String sourceModule) { this.sourceModule = sourceModule; }
    public UUID getSourceRecordId() { return sourceRecordId; }
    public void setSourceRecordId(UUID sourceRecordId) { this.sourceRecordId = sourceRecordId; }
    public String getTargetModule() { return targetModule; }
    public void setTargetModule(String targetModule) { this.targetModule = targetModule; }
    public UUID getTargetRecordId() { return targetRecordId; }
    public void setTargetRecordId(UUID targetRecordId) { this.targetRecordId = targetRecordId; }
    public String getRelationshipType() { return relationshipType; }
    public void setRelationshipType(String relationshipType) { this.relationshipType = relationshipType; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
