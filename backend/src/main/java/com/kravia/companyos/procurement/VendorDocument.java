package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vendor_documents")
public class VendorDocument extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vendor_id")
    private ProcurementVendor vendor;

    private UUID documentId;

    @Column(nullable = false)
    private String documentTitle;

    private String documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus status = ProcurementStatus.ACTIVE;

    @Column(length = 4000)
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public ProcurementVendor getVendor() { return vendor; }
    public void setVendor(ProcurementVendor vendor) { this.vendor = vendor; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }
    public ProcurementStatus getStatus() { return status; }
    public void setStatus(ProcurementStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
