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
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "software_licenses")
public class SoftwareLicense extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private CompanyAsset asset;

    @Column(nullable = false)
    private String licenseName;

    private String provider;
    private String licenseKeyReference;
    private Integer seats;
    private Integer assignedSeats;
    private LocalDate renewalDate;

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
    public String getLicenseName() { return licenseName; }
    public void setLicenseName(String licenseName) { this.licenseName = licenseName; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getLicenseKeyReference() { return licenseKeyReference; }
    public void setLicenseKeyReference(String licenseKeyReference) { this.licenseKeyReference = licenseKeyReference; }
    public Integer getSeats() { return seats; }
    public void setSeats(Integer seats) { this.seats = seats; }
    public Integer getAssignedSeats() { return assignedSeats; }
    public void setAssignedSeats(Integer assignedSeats) { this.assignedSeats = assignedSeats; }
    public LocalDate getRenewalDate() { return renewalDate; }
    public void setRenewalDate(LocalDate renewalDate) { this.renewalDate = renewalDate; }
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