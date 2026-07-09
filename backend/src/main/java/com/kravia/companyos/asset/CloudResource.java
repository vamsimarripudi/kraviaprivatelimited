package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "cloud_resources")
public class CloudResource extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private CompanyAsset asset;

    @Column(nullable = false)
    private String resourceName;

    private String provider;
    private String resourceType;
    private String region;
    private String environment;

    @Column(precision = 19, scale = 2)
    private BigDecimal monthlyCost;

    private String owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public CompanyAsset getAsset() { return asset; }
    public void setAsset(CompanyAsset asset) { this.asset = asset; }
    public String getResourceName() { return resourceName; }
    public void setResourceName(String resourceName) { this.resourceName = resourceName; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public BigDecimal getMonthlyCost() { return monthlyCost; }
    public void setMonthlyCost(BigDecimal monthlyCost) { this.monthlyCost = monthlyCost; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public AssetStatus getStatus() { return status; }
    public void setStatus(AssetStatus status) { this.status = status; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}