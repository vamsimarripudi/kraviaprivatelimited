package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "procurement_approvals")
public class ProcurementApproval extends BaseEntity {
    @Column(nullable = false)
    private String approvalTitle;

    @Column(nullable = false, length = 80)
    private String approvalType;

    private String linkedRecordType;
    private UUID linkedRecordId;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus status = ProcurementStatus.PENDING_APPROVAL;

    @Column(nullable = false)
    private String requestedBy;

    private String approver;

    @Column(length = 4000)
    private String approvalNotes;

    private LocalDate approvalDate;

    @Column(length = 4000)
    private String rejectionReason;

    private Instant archivedAt;

    public String getApprovalTitle() { return approvalTitle; }
    public void setApprovalTitle(String approvalTitle) { this.approvalTitle = approvalTitle; }
    public String getApprovalType() { return approvalType; }
    public void setApprovalType(String approvalType) { this.approvalType = approvalType; }
    public String getLinkedRecordType() { return linkedRecordType; }
    public void setLinkedRecordType(String linkedRecordType) { this.linkedRecordType = linkedRecordType; }
    public UUID getLinkedRecordId() { return linkedRecordId; }
    public void setLinkedRecordId(UUID linkedRecordId) { this.linkedRecordId = linkedRecordId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public ProcurementStatus getStatus() { return status; }
    public void setStatus(ProcurementStatus status) { this.status = status; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getApprovalNotes() { return approvalNotes; }
    public void setApprovalNotes(String approvalNotes) { this.approvalNotes = approvalNotes; }
    public LocalDate getApprovalDate() { return approvalDate; }
    public void setApprovalDate(LocalDate approvalDate) { this.approvalDate = approvalDate; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
