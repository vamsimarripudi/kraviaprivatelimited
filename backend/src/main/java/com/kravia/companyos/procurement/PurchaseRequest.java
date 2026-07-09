package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementPriority;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
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
@Table(name = "purchase_requests")
public class PurchaseRequest extends BaseEntity {
    @Column(nullable = false)
    private String requestTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vendor_id")
    private ProcurementVendor vendor;

    @Column(nullable = false, length = 4000)
    private String purpose;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal estimatedAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementPriority priority = ProcurementPriority.MEDIUM;

    @Column(nullable = false)
    private String requestedBy;

    private LocalDate requiredDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus status = ProcurementStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus approvalStatus = ProcurementStatus.PENDING_APPROVAL;

    @Column(length = 4000)
    private String notes;

    private Instant archivedAt;

    public String getRequestTitle() { return requestTitle; }
    public void setRequestTitle(String requestTitle) { this.requestTitle = requestTitle; }
    public ProcurementVendor getVendor() { return vendor; }
    public void setVendor(ProcurementVendor vendor) { this.vendor = vendor; }
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    public BigDecimal getEstimatedAmount() { return estimatedAmount; }
    public void setEstimatedAmount(BigDecimal estimatedAmount) { this.estimatedAmount = estimatedAmount; }
    public ProcurementPriority getPriority() { return priority; }
    public void setPriority(ProcurementPriority priority) { this.priority = priority; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public LocalDate getRequiredDate() { return requiredDate; }
    public void setRequiredDate(LocalDate requiredDate) { this.requiredDate = requiredDate; }
    public ProcurementStatus getStatus() { return status; }
    public void setStatus(ProcurementStatus status) { this.status = status; }
    public ProcurementStatus getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(ProcurementStatus approvalStatus) { this.approvalStatus = approvalStatus; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
