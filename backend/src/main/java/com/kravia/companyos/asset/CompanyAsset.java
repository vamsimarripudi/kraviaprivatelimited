package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetEnums.AssetCategory;
import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.procurement.ProcurementVendor;
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
import java.time.LocalDate;

@Entity
@Table(name = "assets")
public class CompanyAsset extends BaseEntity {
    @Column(nullable = false)
    private String assetName;

    @Column(nullable = false, unique = true)
    private String assetCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetCategory category;

    @Column(columnDefinition = "text")
    private String description;

    private LocalDate purchaseDate;

    @Column(precision = 19, scale = 2)
    private BigDecimal purchaseCost;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vendor_id")
    private ProcurementVendor vendor;

    private String assignedTo;
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetStatus status;

    private LocalDate warrantyStartDate;
    private LocalDate warrantyEndDate;
    private LocalDate renewalDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getAssetName() { return assetName; }
    public void setAssetName(String assetName) { this.assetName = assetName; }
    public String getAssetCode() { return assetCode; }
    public void setAssetCode(String assetCode) { this.assetCode = assetCode; }
    public AssetCategory getCategory() { return category; }
    public void setCategory(AssetCategory category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }
    public BigDecimal getPurchaseCost() { return purchaseCost; }
    public void setPurchaseCost(BigDecimal purchaseCost) { this.purchaseCost = purchaseCost; }
    public ProcurementVendor getVendor() { return vendor; }
    public void setVendor(ProcurementVendor vendor) { this.vendor = vendor; }
    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public AssetStatus getStatus() { return status; }
    public void setStatus(AssetStatus status) { this.status = status; }
    public LocalDate getWarrantyStartDate() { return warrantyStartDate; }
    public void setWarrantyStartDate(LocalDate warrantyStartDate) { this.warrantyStartDate = warrantyStartDate; }
    public LocalDate getWarrantyEndDate() { return warrantyEndDate; }
    public void setWarrantyEndDate(LocalDate warrantyEndDate) { this.warrantyEndDate = warrantyEndDate; }
    public LocalDate getRenewalDate() { return renewalDate; }
    public void setRenewalDate(LocalDate renewalDate) { this.renewalDate = renewalDate; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}