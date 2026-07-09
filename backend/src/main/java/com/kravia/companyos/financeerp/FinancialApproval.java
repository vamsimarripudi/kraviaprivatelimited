package com.kravia.companyos.financeerp;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalType;
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
@Table(name = "financial_approvals")
public class FinancialApproval extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private FinancialApprovalType approvalType;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private FinancialApprovalStatus status = FinancialApprovalStatus.DRAFT;

    @Column(nullable = false)
    private String requestedBy;

    private String approver;

    @Column(length = 4000)
    private String approvalNotes;

    private LocalDate approvalDate;
    private String linkedRecordType;
    private UUID linkedRecordId;

    @Column(length = 4000)
    private String rejectionReason;

    private Instant archivedAt;

    public FinancialApprovalType getApprovalType() { return approvalType; }
    public void setApprovalType(FinancialApprovalType approvalType) { this.approvalType = approvalType; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public FinancialApprovalStatus getStatus() { return status; }
    public void setStatus(FinancialApprovalStatus status) { this.status = status; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getApprovalNotes() { return approvalNotes; }
    public void setApprovalNotes(String approvalNotes) { this.approvalNotes = approvalNotes; }
    public LocalDate getApprovalDate() { return approvalDate; }
    public void setApprovalDate(LocalDate approvalDate) { this.approvalDate = approvalDate; }
    public String getLinkedRecordType() { return linkedRecordType; }
    public void setLinkedRecordType(String linkedRecordType) { this.linkedRecordType = linkedRecordType; }
    public UUID getLinkedRecordId() { return linkedRecordId; }
    public void setLinkedRecordId(UUID linkedRecordId) { this.linkedRecordId = linkedRecordId; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
